const admin = require('firebase-admin');
const axios = require('axios');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Cerebro Logístico de Taxi La Pobla Activo 24/7! 🚕💨'));
app.listen(process.env.PORT || 3000, () => console.log('Servidor Web iniciado.'));

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN_INSTANCE;
const LINK_RESENA = "https://share.google/Qb290PMlVTB4Torcn";

// 🚨 PON AQUÍ TU ENLACE PROVISIONAL DE NETLIFY SIN LA BARRA AL FINAL
const DOMINIO = "https://taxilapobladevallbona.netlify.app"; 

async function enviarWhatsApp(telefono, mensaje) {
    try {
        let telfLimpio = telefono.replace(/[^0-9]/g, '');
        if (telfLimpio.length === 9) telfLimpio = '34' + telfLimpio;
        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
        await axios.post(url, { chatId: `${telfLimpio}@c.us`, message: mensaje });
        console.log(`✅ WhatsApp enviado a ${telfLimpio}`);
    } catch (error) {
        console.error(`❌ Error al enviar a ${telefono}:`, error.message);
    }
}

// =======================================================
// 1. VIGILANTE DE VIAJES (Automáticos)
// =======================================================
db.collection('reservations').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        const resId = change.doc.id;
        
        if (change.type === 'added' && data.timestamp && data.timestamp < (Date.now() - 5 * 60000)) return;

        const nameF = data.name ? data.name.split(' ')[0] : 'Cliente';
        const phone = data.phone || '';
        const isVipUser = data.isVip || (data.vipCode && data.vipCode.trim() !== "REGULAR" && data.vipCode.trim() !== "");
        
        let trackURL = `${DOMINIO}/perfil-cliente.html?track=${resId}`;
        let profileURL = `${DOMINIO}/perfil-cliente.html`;
        let indexURL = `${DOMINIO}/index.html`;

        if (change.type === 'added' && data.status === 'Pendiente' && !data.notifiedPendiente) {
            await db.collection('reservations').doc(resId).update({ notifiedPendiente: true });
            let msg = `🚕 *TAXI LA POBLA* | *Nueva Solicitud* 📩\n\n👋 Hola *${nameF}*, hemos recibido tu petición de traslado:\n\n📍 *Recogida:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Fecha:* ${data.date} a las ${data.time}h\n💶 *Importe Est.:* ${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n\n⏳ *Estado:* 🔍 Buscando conductor...\n\nEn unos minutos te confirmaremos el vehículo asignado. ¡Gracias por elegirnos! ✨`;
            if (phone) await enviarWhatsApp(phone, msg);
        }

        if (change.type === 'modified') {
            if (data.status === 'Confirmado' && !data.notifiedConfirmado && data.driverId && data.driverId !== "Red de Compañeros") {
                await db.collection('reservations').doc(resId).update({ notifiedConfirmado: true });
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *¡Reserva Confirmada!* ✅\n\n🌟 Estimado/a *${nameF}*, su trayecto ha sido validado con éxito.\n\n🚗 *Vehículo:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Cuándo:* ${data.date} a las ${data.time}h\n\n👔 Su vehículo estará esperándole con la máxima puntualidad. ¡Gracias por confiar en nuestro servicio premium! ✨`
                    : `🚕 *TAXI LA POBLA* | *¡Reserva Confirmada!* ✅\n\n👋 Hola *${nameF}*, tu trayecto ha sido confirmado.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n📅 *Cuándo:* ${data.date} a las ${data.time}h\n\n⏱️ Estaremos allí puntualmente. ¡Buen viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'En Camino' && !data.notifiedEnCamino) {
                await db.collection('reservations').doc(resId).update({ notifiedEnCamino: true });
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *¡Vehículo en Camino!* 📍\n\n🌟 Estimado/a *${nameF}*, su conductor oficial se dirige al punto de recogida.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ *Siga su taxi en tiempo real aquí:*\n🔗 ${trackURL}\n\n💎 *Recuerde:* Este viaje sumará saldo a su cartera usando su código VIP: *${data.vipCode}*.\n\n¡Nos vemos en unos minutos! ⏱️✨`
                    : `🚕 *TAXI LA POBLA* | *¡Vehículo en Camino!* 📍\n\n👋 Hola *${nameF}*, tu conductor se dirige a recogerte.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ *Siga su taxi en tiempo real aquí:*\n🔗 ${trackURL}\n\n💡 *¿Sabías que...?* Si accedes al enlace, podrás crear tu perfil VIP GRATIS y acumular un 8% de saldo.\n\n¡Nos vemos pronto! ⏱️🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Esperando' && !data.notifiedEsperando) {
                await db.collection('reservations').doc(resId).update({ notifiedEsperando: true });
                let msg = `🚕 *TAXI LA POBLA* | *¡Tu taxi ha llegado!* 🚨\n\n👋 Hola *${nameF}*, te informamos de que el conductor ya está esperándote en la puerta:\n\n📍 *Ubicación:* ${data.origin}\n\n🚪 Puedes salir cuando estés listo/a. ¡Buen viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Finalizado' && !data.notifiedFinalizado) {
                await db.collection('reservations').doc(resId).update({ notifiedFinalizado: true });
                let msg = '';
                let billed = parseFloat(data.billedPrice || 0).toFixed(2);
                let earned = parseFloat(data.rewardEarned || 0);

                if (isVipUser) {
                    if (data.paidWithWallet === true || data.paidWithWallet === 'true' || data.paidWithWallet > 0) {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado* 🏁\n\nEstimado/a *${nameF}*, su viaje ha sido *abonado íntegramente* con sus puntos.\n\n🧾 *Resumen:*\n🛣️ Coste oficial: ${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n🎁 Saldo VIP usado: -${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n\n⭐ ¿Nos regala 5 estrellas en Google?\n👉 ${LINK_RESENA}\n\n¡Gracias por su inmensa lealtad! 👑`;
                    } else if (earned > 0) {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado* 🏁\n\nEstimado/a *${nameF}*, gracias por viajar con nosotros.\n\n🧾 *Resumen:*\n💶 Abonado: ${billed}€\n💎 Cashback generado (8%): *+${earned.toFixed(2)}€*\n\n📱 Consulte su nuevo saldo aquí:\n🔗 ${profileURL}\n\n⭐ ¿Nos regala 5 estrellas en Google?\n👉 ${LINK_RESENA}\n\n¡Hasta la próxima! ✨`;
                    } else {
                        msg = `🌟 *TAXI LA POBLA VIP* | *Trayecto Finalizado* 🏁\n\nEstimado/a *${nameF}*, su viaje ha concluido con éxito.\n\nHa sido un auténtico placer llevarle a su destino. ¿Nos ayudaría con una breve reseña de 5 estrellas en Google?:\n⭐ ${LINK_RESENA}\n\n¡Siempre a su disposición! 🚕`;
                    }
                } else {
                    msg = `🚕 *TAXI LA POBLA* | *Trayecto Finalizado* 🏁\n\n👋 Hola *${nameF}*, gracias por confiar en nosotros.\n\n💶 *Importe Abonado:* ${billed}€\n\n🎁 *¡Hazte VIP GRATIS!*\nEntra en tu perfil, pulsa "Ascender a VIP" y acumula un 8% de saldo en cada viaje.\n🔗 ${profileURL}\n\n⭐ ¿Nos regala 5 estrellas en Google?\n👉 ${LINK_RESENA}\n\n¡Que tengas un gran día! 🌟`;
                }
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Cancelado' && !data.notifiedCancelado) {
                await db.collection('reservations').doc(resId).update({ notifiedCancelado: true });
                let msg = `❌ *TAXI LA POBLA* | *Reserva Cancelada*\n\nEstimado/a *${nameF}*, le informamos de que su reserva ha sido cancelada.\n\n${data.cancelReason ? `📝 *Motivo:* ${data.cancelReason}\n\n` : ''}🔄 Si desea hacer una nueva solicitud, visite nuestra web:\n🔗 ${indexURL}\n\nDisculpe las molestias. 🙏`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
        }
    });
});

// =======================================================
// 2. VIGILANTE DE CLIENTES (Para Botones VIP Automáticos)
// =======================================================
db.collection('clients').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
            const clientData = change.doc.data();
            
            if (clientData.triggerReminder && clientData.triggerReminder !== clientData.lastReminderSent) {
                await db.collection('clients').doc(change.doc.id).update({ lastReminderSent: clientData.triggerReminder });
                
                const nameF = clientData.name.split(' ')[0];
                let msg = "";
                
                if (clientData.vipCode) {
                    msg = `👑 *TAXI LA POBLA VIP*\n\nEstimado/a *${nameF}*,\n\nLe recordamos que es miembro exclusivo de nuestro Club VIP.\n\n🔐 Su código secreto es: *${clientData.vipCode}*\n\n💰 Puede revisar su saldo acumulado aquí:\n🔗 ${DOMINIO}/perfil-cliente.html\n\n¡Le esperamos pronto! 🚕✨`;
                } else {
                    msg = `🚕 *TAXI LA POBLA*\n\n👋 Estimado/a *${nameF}*,\n\nLe invitamos formalmente a nuestro *Club VIP*.\n\nAl reservar desde la web y marcar la casilla VIP obtendrá:\n💎 8% de reembolso en cada viaje.\n🧳 Prioridad en reservas.\n📱 Área Privada de saldo.\n\n¡Es 100% GRATIS! Únase en su próxima reserva:\n🔗 ${DOMINIO}/index.html`;
                }
                
                if (clientData.phone) await enviarWhatsApp(clientData.phone, msg);
            }
        }
    });
});
