const admin = require('firebase-admin');
const axios = require('axios');
const express = require('express');

// 1. Servidor web básico
const app = express();
app.get('/', (req, res) => res.send('Cerebro Logístico de Taxi La Pobla Activo 24/7! 🚕💨'));
app.listen(process.env.PORT || 3000, () => console.log('Servidor Web iniciado.'));

// 2. Inicializar Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 3. Credenciales Green API
const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN_INSTANCE;
const LINK_RESENA = "https://share.google/Qb290PMlVTB4Torcn";

// Función enviar WhatsApp
async function enviarWhatsApp(telefono, mensaje) {
    try {
        let telfLimpio = telefono.replace(/[^0-9]/g, '');
        if (telfLimpio.length === 9) telfLimpio = '34' + telfLimpio;
        
        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
        const payload = {
            chatId: `${telfLimpio}@c.us`,
            message: mensaje
        };

        await axios.post(url, payload);
        console.log(`✅ WhatsApp enviado a ${telfLimpio}`);
    } catch (error) {
        console.error(`❌ Error al enviar a ${telefono}:`, error.response ? error.response.data : error.message);
    }
}

// 4. EL VIGILANTE DE ESTADOS DE VIAJES
console.log("👀 Vigilante de reservas conectado a Firebase...");

db.collection('reservations').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        const resId = change.doc.id;
        
        // 🚨 EL ARREGLO ESTÁ AQUÍ 🚨
        // Ignoramos SOLO si es un volcado masivo de viajes viejos al reiniciar el servidor.
        if (change.type === 'added' && data.timestamp && data.timestamp < (Date.now() - 5 * 60000)) return;

        const nameF = data.name ? data.name.split(' ')[0] : 'Cliente';
        const phone = data.phone || '';
        const isVipUser = data.isVip || (data.vipCode && data.vipCode.trim() !== "REGULAR" && data.vipCode.trim() !== "");
        
        let currentURL = "https://taxilapobladevallbona.com";
        let trackURL = `${currentURL}/perfil-cliente.html?track=${resId}`;
        let profileURL = `${currentURL}/perfil-cliente.html`;
        let indexURL = `${currentURL}/index.html`;

        // CASO A: NUEVA RESERVA
        if (change.type === 'added' && data.status === 'Pendiente') {
            console.log(`🚨 NUEVA RESERVA: ${data.name}`);
            let msg = `🚕 *TAXI LA POBLA* | *Solicitud Recibida* 📩\n\nHola *${nameF}*, hemos recibido tu solicitud de traslado correctamente:\n\n📍 *Origen:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Cuándo:* ${data.date} a las ${data.time}h\n💶 *Importe Est:* ${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n\n⏳ *Estado:* Buscando conductor en la red. En unos minutos te enviaremos la confirmación definitiva con los datos del taxi asignado. ¡Gracias!`;
            if (phone) await enviarWhatsApp(phone, msg);
        }

        // CASO B: MODIFICACIÓN (CAMBIO DE ESTADO)
        if (change.type === 'modified') {
            console.log(`🔄 MODIFICACIÓN EN VIAJE ${resId} - Nuevo Estado: ${data.status}`);

            if (data.status === 'Confirmado' && data.driverId && data.driverId !== "Red de Compañeros") {
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *Reserva Confirmada* ✅\n\nEstimado/a *${nameF}*, su trayecto ha sido asignado y validado con éxito.\n\n🚗 *Vehículo Oficial:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Fecha y Hora:* ${data.date} a las ${data.time}h\n\nSu vehículo estará esperándole con la máxima puntualidad. ¡Gracias por confiar en nuestro servicio premium! ✨`
                    : `🚕 *TAXI LA POBLA* | *Reserva Confirmada* ✅\n\nHola *${nameF}*, tu trayecto ha sido confirmado con éxito.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n📅 *Fecha y Hora:* ${data.date} a las ${data.time}h\n\nEstaremos allí puntualmente. ¡Le deseamos un excelente viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'En Camino') {
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *Vehículo en Camino* 📍\n\nEstimado/a *${nameF}*, su conductor oficial ha iniciado el trayecto hacia su punto de recogida.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ Siga la ubicación de su taxi en tiempo real a través de su Área Segura:\n🔗 ${trackURL}\n\n💎 *Recuerde:* Como miembro VIP, este viaje sumará saldo a su cartera. Su código secreto es: *${data.vipCode || 'Revisar en web'}*.\n\n¡Nos vemos en unos minutos! ✨`
                    : `🚕 *TAXI LA POBLA* | *Vehículo en Camino* 📍\n\nHola *${nameF}*, tu conductor ha iniciado el trayecto hacia tu punto de recogida.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ Siga la ubicación exacta de tu taxi en tiempo real aquí:\n🔗 ${trackURL}\n\n💡 *¿Sabías que...?* Si accedes al enlace para ver tu taxi, podrás crear tu perfil VIP totalmente gratis y empezar a acumular un 8% de reembolso en tus viajes.\n\n¡Nos vemos en unos minutos! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Esperando') {
                let msg = `🚕 *TAXI LA POBLA* | *Tu vehículo ha llegado* 🚨\n\nHola *${nameF}*, le informamos de que su conductor ya se encuentra esperándole en la puerta en el punto de recogida:\n\n📍 *Ubicación:* ${data.origin}\n\nPuede salir cuando esté listo. ¡Buen viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Finalizado') {
                let msg = '';
                let billed = parseFloat(data.billedPrice || 0).toFixed(2);
                let earned = parseFloat(data.rewardEarned || 0);

                if (isVipUser) {
                    if (data.paidWithWallet === true || data.paidWithWallet === 'true' || data.paidWithWallet > 0) {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado*\n\nEstimado/a *${nameF}*, su viaje ha concluido con éxito y ha sido *abonado íntegramente* con su saldo VIP.\n\n🧾 *Resumen:*\n- Coste del viaje: ${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n- Saldo VIP utilizado: -${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n\nSu satisfacción es nuestro mayor premio. ¿Nos dejaría una reseña de 5 estrellas en Google?:\n⭐ ${LINK_RESENA}\n\n¡Gracias por su inmensa lealtad! 👑`;
                    } else if (earned > 0) {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado*\n\nEstimado/a *${nameF}*, gracias por viajar una vez más con nosotros.\n\n🧾 *Resumen:*\n- Total Abonado: ${billed}€\n- Cashback VIP generado (8%): *+${earned.toFixed(2)}€*\n\nPuede consultar su nuevo saldo acumulado entrando en su Área VIP:\n🔗 ${profileURL}\n\n¿Nos regala 5 estrellas en Google? Nos ayuda muchísimo:\n⭐ ${LINK_RESENA}\n\n¡Hasta el próximo viaje! ✨`;
                    } else {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado*\n\nEstimado/a *${nameF}*, su viaje ha concluido con éxito.\n\nHa sido un auténtico placer llevarle a su destino. ¿Nos ayudaría con una breve reseña de 5 estrellas en Google?:\n⭐ ${LINK_RESENA}\n\n¡Siempre a su disposición! 🚕`;
                    }
                } else {
                    msg = `🚕 *TAXI LA POBLA* | *Trayecto Finalizado* 🏁\n\nEstimado/a *${nameF}*, gracias por confiar en nuestro servicio.\n\n💶 *Importe Abonado:* ${billed}€\n\n💡 *¿Sabías que...?* En tu Perfil de Cliente tienes un botón para **ASCENDER A VIP GRATIS**. ¡Solo tienes que presionarlo y acumularás un 8% de saldo a tu favor en cada trayecto!\n🔗 *Vaya a su Perfil aquí:* ${profileURL}\n\n¿Nos regala 5 estrellas en Google?:\n⭐ ${LINK_RESENA}\n\n¡Le deseamos un gran día! 🌟`;
                }
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Cancelado') {
                let msg = `❌ *TAXI LA POBLA* | *Aviso de Cancelación*\n\nEstimado/a *${nameF}*, le informamos de que su solicitud de reserva ha sido cancelada en nuestro sistema.\n\n${data.cancelReason ? `📝 *Motivo:* ${data.cancelReason}\n\n` : ''}Si se trataba de un error o desea modificar los datos, puede realizar una nueva solicitud de inmediato desde nuestra web oficial:\n🔗 ${indexURL}\n\nDisculpe las molestias.`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
        }
    });
});
