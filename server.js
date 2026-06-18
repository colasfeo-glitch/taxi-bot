const admin = require('firebase-admin');
const axios = require('axios');
const express = require('express');

// 1. Configuramos el servidor web básico (para que Render no se apague por error)
const app = express();
app.get('/', (req, res) => res.send('Bot de Taxi La Pobla funcionando 24/7! 🚕💨'));
app.listen(process.env.PORT || 3000, () => console.log('Servidor Web iniciado.'));

// 2. Cargamos las llaves de Firebase desde las variables secretas
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 3. Credenciales de Green API (Motor de WhatsApp)
const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN_INSTANCE;

// Función para enviar WhatsApp con Green API
async function enviarWhatsApp(telefono, mensaje) {
    try {
        // Limpiamos el teléfono (quitamos el +, espacios, etc)
        let telfLimpio = telefono.replace(/[^0-9]/g, '');
        // Si no tiene el prefijo de España y tiene 9 cifras, se lo ponemos
        if (telfLimpio.length === 9) telfLimpio = '34' + telfLimpio;
        
        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
        const payload = {
            chatId: `${telfLimpio}@c.us`,
            message: mensaje
        };

        await axios.post(url, payload);
        console.log(`✅ WhatsApp enviado a ${telfLimpio}`);
    } catch (error) {
        console.error(`❌ Error al enviar WhatsApp:`, error.response ? error.response.data : error.message);
    }
}

// 4. EL VIGILANTE 24/7 DE FIREBASE
console.log("👀 Iniciando vigilancia en la base de datos de reservas...");

let inicio = Date.now(); // Evitar que mande mensajes de viajes viejos al reiniciar

db.collection('reservations').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        
        // Solo reaccionar a cosas que pasen DESPUÉS de encender el servidor
        if (data.timestamp && data.timestamp < inicio) return;

        // CASO A: NUEVA RESERVA (Avisar a la central o al cliente)
        if (change.type === 'added' && data.status === 'Pendiente') {
            console.log("🚨 NUEVA RESERVA DETECTADA:", data.name);
            
            // 1. Mensaje automático para el cliente confirmando recepción
            const msgCliente = `🚕 *TAXI LA POBLA* | *Solicitud Recibida*\n\nHola ${data.name.split(' ')[0]}, hemos recibido tu solicitud de reserva.\n\n📍 Desde: ${data.origin}\n🏁 Hasta: ${data.destination}\n📅 Fecha: ${data.date} a las ${data.time}h\n\nEn unos minutos te confirmaremos la asignación de tu vehículo. ¡Gracias!`;
            
            if (data.phone) {
                await enviarWhatsApp(data.phone, msgCliente);
            }
        }

        // Podremos añadir más casos (GPS, Cancelado, etc.) aquí mismo después.
    });
});
