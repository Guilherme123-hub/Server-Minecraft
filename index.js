const express = require('express');
const { Rcon } = require('rcon-client');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

app.post('/webhook', async (req, res) => {
    const data = req.body;
    if (data.action === 'payment.updated' || data.type === 'payment') {
        const payment = await new Payment(client).get({ id: data.data.id });
        
        // Se aprovado, entrega o comando
        if (payment.status === 'approved') {
            const nick = payment.external_reference; // Você passará o nick aqui
            const rcon = await Rcon.connect({
                host: process.env.SERVER_IP,
                port: parseInt(process.env.RCON_PORT),
                password: process.env.RCON_PASSWORD
            });
            await rcon.send(`give ${nick} diamond 64`); // COMANDO DE EXEMPLO
            await rcon.end();
            console.log(`Kit entregue para ${nick}`);
        }
    }
    res.status(200).send('OK');
});

app.listen(process.env.PORT || 3000);