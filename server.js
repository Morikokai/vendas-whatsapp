require('dotenv').config();

const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const { gerarToken } = require('./auth');
const express = require('express');
const cors = require('cors');
const parsePedido = require('./parser');
const pool = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  console.log('Painel conectado:', socket.id);
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.send('Servidor rodando 🚀');
});

// VERIFICAÇÃO DO WEBHOOK DA META
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// RECEBE MENSAGENS DO WHATSAPP E TESTE LOCAL
app.post('/webhook', async (req, res) => {
  try {
    console.log("Recebido da Meta:", JSON.stringify(req.body, null, 2));

    // 🔥 PEGAR DADOS CORRETOS DO WHATSAPP
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages) {
      return res.sendStatus(200);
    }

    const mensagemRecebida = messages[0].text?.body;
    const numeroCliente = messages[0].from;

    console.log("Mensagem:", mensagemRecebida);

    const pedido = parsePedido(mensagemRecebida);

    if (!pedido.cliente || !pedido.produto) {
      console.log("Pedido incompleto");
      return res.sendStatus(200);
    }

    // 💾 SALVAR NO BANCO
    const resultado = await pool.query(
      `INSERT INTO vendas (cliente, produto, sabor, pagamento, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        pedido.cliente,
        pedido.produto,
        pedido.sabor || null,
        pedido.pagamento || null,
        'novo'
      ]
    );

    const venda = resultado.rows[0];

    console.log("Venda salva:", venda);

    io.emit('nova_venda', venda);

    // 🤖 RESPONDER NO WHATSAPP
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: numeroCliente,
        text: {
          body: `✅ Pedido recebido!\n\n👤 Cliente: ${pedido.cliente}\n🍕 Produto: ${pedido.produto}`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);

  } catch (erro) {
  console.error("Erro no webhook:", erro);
  res.sendStatus(500);
}
});

app.get('/vendas', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM vendas ORDER BY criado_em DESC'
    );

    res.json(resultado.rows);

  } catch (erro) {
    console.error('Erro ao buscar vendas:', erro);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

app.put('/vendas/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ erro: 'Status não enviado' });
    }

    const resultado = await pool.query(
      `UPDATE vendas
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    const vendaAtualizada = resultado.rows[0];

    io.emit('status_atualizado', vendaAtualizada);

    res.json({ ok: true, venda: vendaAtualizada });

  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    const usuario = resultado.rows[0];

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha inválida' });
    }

    const token = gerarToken(usuario);

    res.json({ ok: true, token });

  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Rodando na porta ${PORT}`);
});