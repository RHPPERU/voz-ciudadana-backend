const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar cliente de Anthropic
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Inicializar Google Custom Search
const customsearch = google.customsearch('v1');

// Base de datos de proyectos reales (ejemplos predefinidos)
const proyectosReales = {
    'perros': [
        {
            titulo: 'Proyecto "Huellas con Amor" - Lima, Perú',
            descripcion: 'Niños del colegio crearon un refugio temporal con apoyo de la municipalidad',
            link: 'https://example.com/huellas-amor',
            solucion: 'Organizar campaña de adopción con apoyo de la municipalidad'
        },
        {
            titulo: 'Red de Alimentación Canina - Colombia',
            descripcion: 'Estudiantes instalaron comederos comunitarios con reciclaje',
            link: 'https://example.com/red-canina',
            solucion: 'Crear puntos de alimentación con material reciclado'
        }
    ],
    'basura': [
        {
            titulo: 'Eco-Brigada Infantil - México',
            descripcion: 'Niños organizaron jornadas de limpieza cada sábado con premios',
            link: 'https://example.com/eco-brigada',
            solucion: 'Crear brigadas semanales de limpieza con sistema de puntos'
        },
        {
            titulo: 'Reciclaje Escolar - Argentina',
            descripcion: 'Implementaron puntos de reciclaje pintados por los niños',
            link: 'https://example.com/reciclaje-escolar',
            solucion: 'Instalar tachos decorados por la comunidad en puntos estratégicos'
        }
    ],
    'parques': [
        {
            titulo: 'Mi Parque Soñado - Chile',
            descripcion: 'Niños diseñaron su parque ideal y la municipalidad lo construyó',
            link: 'https://example.com/parque-sonado',
            solucion: 'Hacer concurso de diseño de parques y presentarlo a la municipalidad'
        },
        {
            titulo: 'Parque Comunitario - España',
            descripcion: 'Vecinos y niños transformaron un lote baldío en parque',
            link: 'https://example.com/parque-comunitario',
            solucion: 'Identificar espacios vacíos y proponer conversión a área verde'
        }
    ],
    'delincuencia': [
        {
            titulo: 'Vecinos Vigilantes - Ecuador',
            descripcion: 'Crearon grupo de WhatsApp con la comisaría para alertas',
            link: 'https://example.com/vecinos-vigilantes',
            solucion: 'Formar red comunitaria de comunicación con autoridades'
        },
        {
            titulo: 'Iluminemos el Barrio - Bolivia',
            descripcion: 'Niños solicitaron más luz en las calles oscuras',
            link: 'https://example.com/iluminemos-barrio',
            solucion: 'Hacer petición formal para mejorar iluminación pública'
        }
    ],
    'señales': [
        {
            titulo: 'Cruce Seguro - Uruguay',
            descripcion: 'Estudiantes pintaron señales temporales y solicitaron oficiales',
            link: 'https://example.com/cruce-seguro',
            solucion: 'Documentar cruces peligrosos y solicitar señalización'
        }
    ],
    'postas': [
        {
            titulo: 'Salud Móvil - Guatemala',
            descripcion: 'Coordinaron visitas mensuales de médicos al barrio',
            link: 'https://example.com/salud-movil',
            solucion: 'Solicitar campaña médica itinerante al centro de salud'
        }
    ]
};

// Función para detectar problema en el mensaje
function detectarProblema(mensaje) {
    const mensajeLower = mensaje.toLowerCase();

    if (mensajeLower.match(/perro|animal|mascota|callejero|gato/)) return 'perros';
    if (mensajeLower.match(/basura|suci|limpi|residuo|desperdicio/)) return 'basura';
    if (mensajeLower.match(/parque|jugar|área verde|recreación|cancha/)) return 'parques';
    if (mensajeLower.match(/delincuen|robo|segur|miedo|peligro/)) return 'delincuencia';
    if (mensajeLower.match(/señal|cruce|tránsito|semáforo/)) return 'señales';
    if (mensajeLower.match(/posta|médico|salud|enferm|doctor/)) return 'postas';
    if (mensajeLower.match(/escuela|colegio|pint|muro|pared|fachada/)) return 'escuela';
    if (mensajeLower.match(/agua|desagüe|caño|tubería|inunda/)) return 'agua';
    if (mensajeLower.match(/luz|alumbrado|poste|oscur/)) return 'luz';
    if (mensajeLower.match(/pista|calle|hueco|bache/)) return 'pistas';

    return null;
}

// Función para buscar proyectos reales en Google
async function buscarProyectosEnGoogle(problema, tipoProblema) {
    try {
        // Mapeo de problemas a queries de búsqueda
        const searchQueries = {
            'perros': 'proyecto niños perros callejeros comunidad',
            'basura': 'proyecto niños limpieza barrio basura',
            'parques': 'proyecto niños creación parque comunidad',
            'delincuencia': 'proyecto niños seguridad barrio vecinal',
            'señales': 'proyecto niños señalización tránsito',
            'postas': 'proyecto salud móvil comunidad',
            'escuela': 'proyecto niños pintar escuela colegio comunidad',
            'agua': 'proyecto niños agua potable desagüe comunidad',
            'luz': 'proyecto niños iluminación alumbrado público',
            'pistas': 'proyecto niños reparación calles pistas baches'
        };

        const query = searchQueries[tipoProblema] || problema;

        const res = await customsearch.cse.list({
            auth: process.env.GOOGLE_API_KEY,
            cx: process.env.GOOGLE_CX,
            q: query,
            num: 3, // Máximo 3 resultados
            gl: 'pe', // Priorizar resultados de Perú
            lr: 'lang_es' // Solo en español
        });

        if (!res.data.items) {
            return [];
        }

        // Formatear resultados
        return res.data.items.map(item => ({
            titulo: item.title,
            descripcion: item.snippet,
            link: item.link
        }));

    } catch (error) {
        console.error('Error en búsqueda de Google:', error.message);
        return []; // Retornar array vacío si falla
    }
}

// Endpoint principal del chat
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }

        // Detectar el tipo de problema
        const tipoProblema = detectarProblema(message);

        // Buscar proyectos reales en Google
        let proyectos = [];
        if (tipoProblema) {
            proyectos = await buscarProyectosEnGoogle(message, tipoProblema);

            // Si Google no encuentra nada, usar base de datos predefinida como fallback
            if (proyectos.length === 0) {
                proyectos = proyectosReales[tipoProblema] || [];
            }
        }

        // Crear prompt para Claude
        const prompt = `Eres un asistente amigable para niños de 7-13 años en Lima, Perú.
Un niño te cuenta sobre un problema en su barrio: "${message}"

Tu tarea:
1. Da un mensaje corto de motivación (1 frase)
2. Sugiere EXACTAMENTE 3 soluciones prácticas que el niño puede hacer

FORMATO DE RESPUESTA (usa EXACTAMENTE este formato):
MENSAJE: [Frase motivadora aquí]
SOLUCIONES:
1. [Primera solución práctica]
2. [Segunda solución práctica]
3. [Tercera solución práctica]

IMPORTANTE:
- Usa lenguaje simple para niños
- Sé breve en cada solución (máximo 15 palabras por solución)
- Usa un tono motivador
- NO uses emojis
- NO uses HTML, solo texto plano`;

        // Llamar a Claude API
        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 400,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        const claudeResponse = response.content[0].text;

        // Parsear respuesta de Claude
        const mensajeMatch = claudeResponse.match(/MENSAJE:\s*(.+?)(?=SOLUCIONES:|$)/s);
        const solucionesMatch = claudeResponse.match(/SOLUCIONES:\s*([\s\S]+)/);

        const mensaje = mensajeMatch ? mensajeMatch[1].trim() : '¡Qué bueno que quieras ayudar a mejorar tu barrio! 💪';
        const soluciones = solucionesMatch
            ? solucionesMatch[1].trim().split('\n').filter(s => s.trim()).map(s => s.replace(/^\d+\.\s*/, ''))
            : ['Habla con tus vecinos sobre el problema', 'Pide ayuda a un adulto de confianza', 'Haz un cartel para mostrar el problema'];

        // Construir respuesta HTML con dos columnas
        let htmlResponse = `<p><strong>${mensaje}</strong></p>`;

        htmlResponse += '<div class="response-container">';

        // Columna izquierda: Enlaces (máximo 3)
        htmlResponse += '<div class="response-column">';
        htmlResponse += '<h3>🔗 Proyectos Similares</h3>';

        if (proyectos.length > 0) {
            proyectos.slice(0, 3).forEach((proyecto, index) => {
                htmlResponse += `
                    <a href="${proyecto.link}" target="_blank" class="project-link">
                        <div class="project-title">${index + 1}. ${proyecto.titulo}</div>
                        <div class="project-description">${proyecto.descripcion}</div>
                    </a>
                `;
            });
        } else {
            htmlResponse += '<p style="color: #999;">No se encontraron proyectos similares</p>';
        }

        htmlResponse += '</div>';

        // Columna derecha: Sugerencias
        htmlResponse += '<div class="response-column">';
        htmlResponse += '<h3>💡 ¿Qué Puedes Hacer?</h3>';

        soluciones.slice(0, 3).forEach((solucion, index) => {
            htmlResponse += `
                <div class="solution-item">
                    <span class="solution-number">${index + 1}.</span> ${solucion}
                </div>
            `;
        });

        htmlResponse += '</div>';
        htmlResponse += '</div>';

        res.json({ response: htmlResponse });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Error procesando mensaje',
            message: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`💬 Endpoint de chat: http://localhost:${PORT}/chat`);
});
