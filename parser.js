function parsePedido(texto) {
  const dados = {};

  texto.split(';').forEach(item => {
    const partes = item.split(':');

    if (partes.length < 2) return;

    const chave = partes[0].trim().toLowerCase();
    const valor = partes[1].trim();

    if (chave === 'cliente') dados.cliente = valor;
    if (chave === 'produto') dados.produto = valor;
    if (chave === 'sabor') dados.sabor = valor;
    if (chave === 'pagamento') dados.pagamento = valor;
  });

  return dados;
}

module.exports = parsePedido;