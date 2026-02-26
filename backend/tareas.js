const cron = require('node-cron');
const db = require('./db');

// Función auxiliar para simular el envío de notificación
// (Más adelante aquí pondremos el código para enviar emails reales)
const enviarAlerta = (titulo, mensaje) => {
    console.log(`\n🔔 [ALERTA NUEVA] ${titulo}`);
    console.log(`📝 Mensaje: ${mensaje}`);
    console.log('--------------------------------------------------');
};

const iniciarTareas = () => {
    console.log('⏰ Sistema de alertas automáticas iniciado...');

    // -----------------------------------------------------------
    // 1. ALERTA DE EXTINTORES (Se ejecuta el día 1 de cada mes a las 8:00 AM)
    // Cron sintaxis: "0 8 1 * *" (Minuto 0, Hora 8, Día 1, Cualquier Mes)
    // -----------------------------------------------------------
    cron.schedule('0 8 1 * *', async () => {
        console.log('🔎 Revisando extintores...');
        try {
            // Buscamos extintores que venzan este mes
            const [extintores] = await db.query(`
                SELECT codigo, ubicacion, fecha_proxima_recarga 
                FROM extintores 
                WHERE MONTH(fecha_proxima_recarga) = MONTH(CURRENT_DATE())
                AND YEAR(fecha_proxima_recarga) = YEAR(CURRENT_DATE())
            `);

            if (extintores.length > 0) {
                extintores.forEach(ext => {
                    enviarAlerta(
                        'Mantenimiento de Extintor', 
                        `El extintor ${ext.codigo} ubicado en ${ext.ubicacion} vence este mes.`
                    );
                });
            } else {
                console.log('✅ No hay extintores por vencer este mes.');
            }
        } catch (error) {
            console.error('Error revisando extintores:', error);
        }
    });

    // -----------------------------------------------------------
    // 2. ALERTA DE CUMPLEAÑOS (Se ejecuta TODOS los días a las 7:00 AM)
    // Cron sintaxis: "0 7 * * *"
    // -----------------------------------------------------------
    cron.schedule('0 7 * * *', async () => {
        console.log('🔎 Buscando cumpleañeros del día...');
        try {
            const [cumpleaneros] = await db.query(`
                SELECT nombre_completo, area 
                FROM empleados 
                WHERE MONTH(fecha_nacimiento) = MONTH(CURRENT_DATE()) 
                AND DAY(fecha_nacimiento) = DAY(CURRENT_DATE())
            `);

            if (cumpleaneros.length > 0) {
                cumpleaneros.forEach(emp => {
                    enviarAlerta(
                        '¡Cumpleaños detectado! 🎂', 
                        `Hoy es el cumpleaños de ${emp.nombre_completo} del área de ${emp.area}.`
                    );
                });
            }
        } catch (error) {
            console.error('Error revisando cumpleaños:', error);
        }
    });

    // -----------------------------------------------------------
    // 3. ALERTA DE CONTRATOS (Se ejecuta TODOS los días a las 7:30 AM)
    // Busca contratos que venzan exactamente en 30 días
    // -----------------------------------------------------------
    cron.schedule('0 7 * * *', async () => {
        console.log('🔎 Revisando vencimiento de contratos...');
        try {
            const [contratos] = await db.query(`
                SELECT nombre_completo, fecha_fin_contrato 
                FROM empleados 
                WHERE DATEDIFF(fecha_fin_contrato, CURRENT_DATE()) = 30
            `);

            if (contratos.length > 0) {
                contratos.forEach(emp => {
                    enviarAlerta(
                        'Vencimiento de Contrato (Preaviso)', 
                        `El contrato de ${emp.nombre_completo} vence en 30 días (${emp.fecha_fin_contrato}).`
                    );
                });
            }
        } catch (error) {
            console.error('Error revisando contratos:', error);
        }
    });
};

module.exports = iniciarTareas;