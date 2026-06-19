const express = require('express');
const { Rcon } = require('rcon-client');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

app.post('/webhook', async (req, res) => {
    const data = req.body;
    
    // Filtra apenas notificações de pagamento aprovado
    if (data.type === 'payment' || data.action === 'payment.updated') {
        try {
            // Busca os detalhes do pagamento no Mercado Pago
            const payment = await new Payment(client).get({ id: data.data.id });
            
            if (payment.status === 'approved') {
                // Pega a referência enviada pelo site (formato esperado: "nick|kit")
                const ref = payment.external_reference; 
                if (!ref || !ref.includes('|')) {
                    throw new Error("Formato de referência inválido. Use 'nick|kit'");
                }

                const [nick, kitName] = ref.split('|'); 
                console.log(`Pagamento aprovado! Jogador: ${nick}, Kit: ${kitName}. Conectando ao RCON...`);

                // Conexão RCON
                const rcon = await Rcon.connect({
                    host: process.env.SERVER_IP,
                    port: parseInt(process.env.RCON_PORT),
                    password: process.env.RCON_PASSWORD
                });

                // Envia o comando personalizado para o servidor
                await rcon.send(`anunciarlit ${nick} ${kitName}`);
                await rcon.end();
                
                console.log(`Comando executado: anunciarlit ${nick} ${kitName}`);
            }
        } catch (error) {
            console.error('Erro na processamento do pagamento:', error);
        }
    }
    
    // Responde 200 OK para o Mercado Pago parar de enviar a notificação
    res.status(200).send('OK');
});

// Inicializa o servidor da ponte
app.listen(process.env.PORT || 3000, () => console.log('Servidor da ponte rodando e escutando webhooks!'));
