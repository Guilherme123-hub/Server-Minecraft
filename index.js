const express = require('express');
const { Rcon } = require('rcon-client');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());

// Permite que o seu site no GitHub Pages faça pedidos para esse servidor
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Configuração do Token do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota para testar se a ponte está viva
app.get('/', (req, res) => res.send('Ponte ativa com API de PIX Automático!'));

// --- A "BOCA" QUE GERA O PIX PARA O SITE ---
app.post('/gerar-pix', async (req, res) => {
    try {
        const { nick, kit, valor } = req.body;
        
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: kit,
                payment_method_id: 'pix',
                payer: { email: 'comprador@minecraft.com' }, // O MP exige um email, usamos um padrão
                external_reference: `${nick}|${kit}` // Essencial para o webhook saber quem é
            }
        });

        // Devolve o código PIX Copia e Cola para o seu site mostrar na tela
        res.json({
            copiaEcola: result.point_of_interaction.transaction_data.qr_code
        });
    } catch (err) {
        console.error("Erro ao gerar PIX:", err);
        res.status(500).json({ erro: "Falha ao gerar o PIX" });
    }
});

// --- O "OUVIDO" QUE ENTREGA O KIT NO SERVIDOR ---
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        console.log('Webhook recebido. Tipo:', data.type || data.action);

        if (data.type === 'payment' || data.action === 'payment.updated') {
            const payment = await new Payment(client).get({ id: data.data.id });
            
            if (payment.status === 'approved') {
                const ref = payment.external_reference;
                if (!ref) return res.status(200).send('OK');

                const [nick, kitName] = ref.split('|');
                console.log(`PAGAMENTO APROVADO! Entregando ${kitName} para ${nick}`);

                const rcon = new Rcon({
                    host: process.env.SERVER_IP,
                    port: parseInt(process.env.RCON_PORT),
                    password: process.env.RCON_PASSWORD
                });

                rcon.on("error", (err) => console.error("Erro RCON:", err));
                
                await rcon.connect();
                // Executa o comando de entregar o kit
                await rcon.send(`anunciarkit ${nick} ${kitName}`);
                await rcon.end();
                console.log('Sucesso na entrega do kit!');
            }
        }
    } catch (err) {
        console.error('ERRO NO WEBHOOK:', err);
    }
    // Sempre responde OK pro Mercado Pago parar de enviar alertas
    res.status(200).send('OK');
});

// Seguranças para o servidor não desligar se der erro
process.on('uncaughtException', (err) => console.error('Erro fatal:', err));
process.on('unhandledRejection', (err) => console.error('Promessa rejeitada:', err));

app.listen(process.env.PORT || 10000, () => console.log('Servidor rodando e pronto para gerar PIX!'));
