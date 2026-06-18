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

// 🚨 PON AQUÍ TU ENLACE PROVISIONAL DE NETLIFY SIN LA BARRA AL FINAL (ej: https://taxi-pobla.netlify.app)
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
// 1. VIGILANTE DE VIAJES (Con protección anti-repetición)
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
            let msg = `🚕 *TAXI LA POBLA* | *Solicitud Recibida* 📩\n\nHola *${nameF}*, hemos recibido tu solicitud de traslado correctamente:\n\n📍 *Origen:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Cuándo:* ${data.date} a las ${data.time}h\n💶 *Importe Est:* ${parseFloat(data.estimatedPrice || 0).toFixed(2)}€\n\n⏳ *Estado:* Buscando conductor en la red. En unos minutos te enviaremos la confirmación definitiva con los datos del taxi asignado. ¡Gracias!`;
            if (phone) await enviarWhatsApp(phone, msg);
        }

        if (change.type === 'modified') {
            if (data.status === 'Confirmado' && !data.notifiedConfirmado && data.driverId && data.driverId !== "Red de Compañeros") {
                await db.collection('reservations').doc(resId).update({ notifiedConfirmado: true });
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *Reserva Confirmada* ✅\n\nEstimado/a *${nameF}*, su trayecto ha sido asignado y validado con éxito.\n\n🚗 *Vehículo Oficial:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n🏁 *Destino:* ${data.destination}\n📅 *Fecha y Hora:* ${data.date} a las ${data.time}h\n\nSu vehículo estará esperándole con la máxima puntualidad. ¡Gracias por confiar en nuestro servicio premium! ✨`
                    : `🚕 *TAXI LA POBLA* | *Reserva Confirmada* ✅\n\nHola *${nameF}*, tu trayecto ha sido confirmado con éxito.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n📍 *Recogida:* ${data.origin}\n📅 *Fecha y Hora:* ${data.date} a las ${data.time}h\n\nEstaremos allí puntualmente. ¡Le deseamos un excelente viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'En Camino' && !data.notifiedEnCamino) {
                await db.collection('reservations').doc(resId).update({ notifiedEnCamino: true });
                let msg = isVipUser
                    ? `🚕 *TAXI LA POBLA VIP* | *Vehículo en Camino* 📍\n\nEstimado/a *${nameF}*, su conductor oficial ha iniciado el trayecto hacia su punto de recogida.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ Siga la ubicación de su taxi en tiempo real a través de su Área Segura:\n🔗 ${trackURL}\n\n💎 *Recuerde:* Como miembro VIP, este viaje sumará saldo a su cartera. Su código secreto es: *${data.vipCode || 'Revisar en web'}*.\n\n¡Nos vemos en unos minutos! ✨`
                    : `🚕 *TAXI LA POBLA* | *Vehículo en Camino* 📍\n\nHola *${nameF}*, tu conductor ha iniciado el trayecto hacia tu punto de recogida.\n\n🚗 *Conductor:* ${data.driverId.toUpperCase()}\n\n🗺️ Siga la ubicación exacta de tu taxi en tiempo real aquí:\n🔗 ${trackURL}\n\n💡 *¿Sabías que...?* Si accedes al enlace para ver tu taxi, podrás crear tu perfil VIP totalmente gratis y empezar a acumular un 8% de reembolso en tus viajes.\n\n¡Nos vemos en unos minutos! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Esperando' && !data.notifiedEsperando) {
                await db.collection('reservations').doc(resId).update({ notifiedEsperando: true });
                let msg = `🚕 *TAXI LA POBLA* | *Tu vehículo ha llegado* 🚨\n\nHola *${nameF}*, le informamos de que su conductor ya se encuentra esperándole en la puerta en el punto de recogida:\n\n📍 *Ubicación:* ${data.origin}\n\nPuede salir cuando esté listo. ¡Buen viaje! 🤝`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
            else if (data.status === 'Finalizado' && !data.notifiedFinalizado) {
                await db.collection('reservations').doc(resId).update({ notifiedFinalizado: true });
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
            else if (data.status === 'Cancelado' && !data.notifiedCancelado) {
                await db.collection('reservations').doc(resId).update({ notifiedCancelado: true });
                let msg = `❌ *TAXI LA POBLA* | *Aviso de Cancelación*\n\nEstimado/a *${nameF}*, le informamos de que su solicitud de reserva ha sido cancelada en nuestro sistema.\n\n${data.cancelReason ? `📝 *Motivo:* ${data.cancelReason}\n\n` : ''}Si se trataba de un error o desea modificar los datos, puede realizar una nueva solicitud de inmediato desde nuestra web oficial:\n🔗 ${indexURL}\n\nDisculpe las molestias.`;
                if (phone) await enviarWhatsApp(phone, msg);
            }
        }
    });
});

// =======================================================
// 2. VIGILANTE DE CLIENTES (Para Botón Recordatorio VIP)
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
                    msg = `*TAXI LA POBLA VIP*\n\nEstimado/a ${nameF},\n\nLe recordamos que usted es miembro exclusivo de nuestro Club VIP.\n\nSu código personal y privado es: *${clientData.vipCode}*\n\nPuede acceder a su Área Privada para revisar su saldo acumulado en el siguiente enlace:\n${DOMINIO}/perfil-cliente.html\n\nRecuerde que si desea realizar una reserva rápida sin iniciar sesión, puede introducir este código en la parte superior del formulario de reservas para asegurar sus beneficios.\n\nGracias por su lealtad.`;
                } else {
                    msg = `*TAXI LA POBLA*\n\nEstimado/a ${nameF},\n\nLe invitamos a formar parte de nuestro exclusivo Club VIP en su próxima reserva.\n\nAl marcar la casilla 'Crear mi perfil Cliente VIP', obtendrá:\n\n- Un 8% de reembolso en todos sus viajes.\n- Prioridad en equipaje y traslados al aeropuerto.\n- Un Área Privada para gestionar su saldo.\n\nEs totalmente gratuito. ¡Le esperamos!\n\nAcceda a nuestra web:\n${DOMINIO}/index.html`;
                }
                
                if (clientData.phone) await enviarWhatsApp(clientData.phone, msg);
            }
        }
    });
});
