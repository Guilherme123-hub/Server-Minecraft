const express = require('express');
const { Rcon } = require('rcon-client');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota de teste para ver se o serviço está vivo
app.get('/', (req, res) => res.send('Ponte ativa!'));

app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        console.log('Webhook recebido:', JSON.stringify(data));

        if (data.type === 'payment' || data.action === 'payment.updated') {
            const payment = await new Payment(client).get({ id: data.data.id });
            
            if (payment.status === 'approved') {
                const ref = payment.external_reference || 'Jogador|KitPadrao';
                const [nick, kitName] = ref.split('|');
                
                console.log(`Entregando: ${kitName} para ${nick}`);

                // Conexão RCON com timeout e tratamento de erro interno
                const rcon = new Rcon({
                    host: process.env.SERVER_IP,
                    port: parseInt(process.env.RCON_PORT),
                    password: process.env.RCON_PASSWORD
                });

                rcon.on("error", (err) => console.error("Erro RCON:", err));
                
                await rcon.connect();
                await rcon.send(`anunciarlit ${nick} ${kitName}`);
                await rcon.end();
                console.log(`Sucesso!`);
            }
        }
    } catch (err) {
        console.error('ERRO NO WEBHOOK (não derrubou o servidor):', err);
    }
    // SEMPRE responde 200 pro Mercado Pago, senão ele fica enviando a mesma mensagem
    res.status(200).send('OK');
});

// Captura erros globais para evitar que o servidor morra
process.on('uncaughtException', (err) => console.error('Erro fatal não capturado:', err));
process.on('unhandledRejection', (err) => console.error('Promessa rejeitada não capturada:', err));

app.listen(process.env.PORT || 10000, () => console.log('Servidor rodando na porta 10000'));
