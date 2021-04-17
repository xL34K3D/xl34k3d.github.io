---
layout: post
title: "Laboratory - Hackthebox Write-up"
date: 2021-04-17 18:00:00 -0300
categories: Hackthebox
---
!(/assets/Laboratory/1.png)
# Resumo
Olá a todos, este é o write-up da máquina Laboratory do Hack The Box, se trata de uma máquina que mistura CVE com abuso de funcionalidades do Gitlab e exploração de binários que não utilizam o PATH absoluto.

# Recon


### Nmap Inicial

```sh
nmap -sC -sV -sT 10.10.10.216
   
22/tcp open ssh OpenSSH 8.2p1 Ubuntu 4ubuntu0.1 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
| 3072 25:ba:64:8f:79:9d:5d:95:97:2c:1b:b2:5e:9b:55:0d (RSA)
| 256 28:00:89:05:55:f9:a2:ea:3c:7d:70:ea:4d:ea:60:0f (ECDSA)
|\_ 256 77:20:ff:e9:46:c0:68:92:1a:0b:21:29:d1:53:aa:87 (ED25519)

80/tcp open http Apache httpd 2.4.41
|\_http-server-header: Apache/2.4.41 (Ubuntu)
|\_http-title: Did not follow redirect to [https://laboratory.htb/](https://laboratory.htb/)

443/tcp open ssl/http Apache httpd 2.4.41 ((Ubuntu))
|\_http-server-header: Apache/2.4.41 (Ubuntu)
|\_http-title: The Laboratory
| ssl-cert: Subject: commonName=laboratory.htb
| Subject Alternative Name: DNS:git.laboratory.htb
| Not valid before: 2020-07-05T10:39:28
|\_Not valid after: 2024-03-03T10:39:28
| tls-alpn:
|\_ http/1.1
```

### Enumeração

Durante a etapa inicial de enumeração foi possível identificar apenas algumas portas abertas, como o serviço do SSH, HTTP e HTTPS, por meio do scan, é possível visualizar que o servidor apache está operando por meio de vhosts.
Dois *vhosts* foram identificados pelo scan do nmap **git.laboratory.htb** e **laboratory.htb**.

```bash 
┌──(l34k3d㉿hanna)-[~/Desktop/HTB/machines/laboratory]
└─$ sudo vim /etc/hosts           
[sudo] password for l34k3d: 
                                     
┌──(l34k3d㉿hanna)-[~/Desktop/HTB/machines/laboratory]
└─$ cat /etc/hosts                                          
127.0.0.1       localhost
127.0.1.1       hanna
10.10.10.216    laboratory.htb git.laboratory.htb
# The following lines are desirable for IPv6 capable hosts
::1     localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters

```

O site *laboratory.htb* se trata de um site estático padrão, com o objetivo de mostrar o trabalho da empresa. Por meio do site é possível identificar alguns possíveis usuários do sistema:

![Image](/assets/Laboratory/2.png)

Já o vhost **git** se trata de um Gitlab, um software open source de colaboração com repositórios e códigos da empresa. Por meio deste site é possível criar uma conta e interagir com a aplicação.

![Image](/assets/Laboratory/3.png)

Visto isto, cadastrei uma conta com um email fictício *l34k3d@laboratory.htb*, para visualizar mais informações sobre esta aplicação. Após a enumeração básica, interagindo com links, foi possível encontrar a versão do Gitlab, que é a 12.8.1.

![Image](/assets/Laboratory/4.png)

Realizando uma rápida pesquisa foi possível encontrar uma [vulnerabilidade](https://packetstormsecurity.com/files/160441/GitLab-File-Read-Remote-Code-Execution.html) de leitura de arquivos para esta versão, que pode evoluir para um RCE (*Remote Code Execution*), caso uma propriedade de configuração consiga ser encontrada.

Como o exploit é feito para o Metasploit, foi realizada a [importação do módulo](https://www.hackers-arise.com/post/2017/06/08/metasploit-basics-part-7-adding-a-new-module-eternalblue) para a sua execução.

![Image](/assets/Laboratory/5.png)

Com o módulo importado, as opções foram configuradas e conseguimos a nossa primeira shell.

![Image](/assets/Laboratory/6.png)
# Exploração

Após perceber algumas limitações na primeira shell, utilizei um módulo de pós exploração chamado shell_to_meterpreter, que acaba por abrir uma nova sessão com o meterpreter, um payload com mais opções de enumeração.

![Image](/assets/Laboratory/7.png)

Após [enumerar](https://book.hacktricks.xyz/linux-unix/privilege-escalation) a máquina e não encontrar nenhum vetor de ataque para escalação de privilégios, foi identificado que o vhost git.laboratory.htb se trata de um docker.

![Image](/assets/Laboratory/8.png)

Como não estava evoluindo no docker escape, decidi olhar o forúm para receber algumas dicas de como prosseguir, muitos usuários deram a dica de ler a documentação do gitlab.
Durante a leitura desta documentação, identifiquei que o Gitlab possui uma maneira de interagir diretamente com sua base de dados, com o intuito de resolução de problemas, por meio do [gitlab rails console](https://docs.gitlab.com/ee/administration/troubleshooting/navigating_gitlab_via_rails_console.html).
Acessando o gitlab rails console foi possível a identificação do usuário dexter, assim, realizei a alteração de sua senha por meio do console e loguei em sua conta por meio do site.

![Image](/assets/Laboratory/9.png)

Para alteração os seguintes comandos foram utilizados:

```rb
user = User.find_by(username: 'dexter')
user.update(password: 'novasenha')
```
E assim logamos no gitlab novamente, onde foi possível identificar um repositório privado:

!(/assets/Laboratory/10.png)

Neste repositório foi possível encontrar a chave privada de SSH do Dexter, sendo possível agora, acessar a máquina real.

![Image](/assets/Laboratory/11.png)

```bash
┌──(l34k3d㉿hanna)-[~/Desktop/HTB/machines/laboratory]
└─$ ssh -i id_rsa dexter@laboratory.htb
dexter@laboratory:~$ id && hostname
uid=1000(dexter) gid=1000(dexter) groups=1000(dexter)
laboratory
dexter@laboratory:~$ 
```

# Escalação de Privilégios

Após a [enumeração da máquina](https://book.hacktricks.xyz/linux-unix/privilege-escalation), foi possível identificar um binário diferente com o SUID setado, ou seja, possível vetor para escalação de privilégios pois o binário é executado como **root**. 

```bash
dexter@laboratory:~$ ls -la /usr/local/bin/docker-security 
-rwsr-xr-x 1 root dexter 16720 Aug 28  2020 /usr/local/bin/docker-security
```

Por meio do [pspy](https://github.com/DominicBreuker/pspy) foi possível entender as ações do binário.

```bash
2021/03/27 20:36:05 CMD: UID=0 PID=4059 | /usr/local/bin/docker-security

2021/03/27 20:36:05 CMD: UID=0 PID=4060 | sh -c chmod 700 /usr/bin/docker

2021/03/27 20:36:05 CMD: UID=0 PID=4062 | sh -c chmod 660 /var/run/docker.sock

2021/03/27 20:36:05 CMD: UID=0 PID=4063 | sh -c chmod 660 /var/run/docker.sock
```

O binário executa um comando que utiliza o **chmod** para alterar a permissão de alguns arquivos do docker. O problema é que o binário *chmod* não está com o caminho completo, abrindo portas para ataques de abuso de PATH, desta forma, criamos um binário chamado *chmod* contendo uma shell reversa e o adicionamos ao nosso PATH de usuário.

![Image](/assets/Laboratory/12.png)

```bash
export PATH=/tmp/l34k3d/:$PATH
```

E executamos o script docker-security:

![Image](/assets/Laboratory/13.png)

Após isso, nosso binário chmod malicioso é executado e recebemos a shell como root.

![Image](/assets/Laboratory/14.png)

# Considerações Finais
As vulnerabilidades que a máquina apresenta são semelhantes a muitos vetores de ataques atualmente, o uso de componentes com vulnerabilidades conhecidas está na OWASP Top 10 e é amplamente explorado por agentes maliciosos.
A chave para comprometer totalmente a máquina foram erros de configuração, como a exposição indevida da chave de SSH, e a criação de um binário com SUID sem o PATH total, a enumeração e pesquisa, como sempre, foram cruciais para a execução dos ataques.
Este foi o meu primeiro write-up, espero que tenham gostado, estou aberto a dicas e sugestões. Contate-me via LinkedIn ou Twitter!
