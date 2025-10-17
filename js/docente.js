// js/docente.js

// Importaciones de Firebase, ahora con todo lo necesario para leer colecciones.
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc,
    getDoc,
    collection,
    addDoc,
    query,      // <--- Para construir consultas
    where,      // <--- Para filtrar con una condición
    getDocs     // <--- Para ejecutar la consulta
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const createRoomForm = document.getElementById('create-room-form');
// Nueva referencia para el contenedor donde mostraremos las salas.
const roomsListContainer = document.getElementById('rooms-list');


// --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ---
const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};


// --- LÓGICA DE VISUALIZACIÓN ---

/**
 * Consulta y muestra las salas creadas por un docente específico.
 * @param {string} userId - El UID del docente.
 */
const displayTeacherRooms = async (userId) => {
    // 1. Vaciamos el contenedor para evitar duplicados si se llama varias veces.
    roomsListContainer.innerHTML = '';

    // 2. Creamos una consulta a la colección 'salas'.
    // La clave aquí es 'where("docenteId", "==", userId)', que filtra
    // y nos trae únicamente las salas de este docente.
    const q = query(collection(db, "salas"), where("docenteId", "==", userId));

    try {
        // 3. Ejecutamos la consulta.
        const querySnapshot = await getDocs(q);

        // 4. Verificamos si la consulta devolvió resultados.
        if (querySnapshot.empty) {
            roomsListContainer.innerHTML = '<p>Aún no has creado ninguna sala.</p>';
            return;
        }

        // 5. Si hay resultados, iteramos sobre cada documento (cada sala).
        querySnapshot.forEach((doc) => {
            const room = doc.data(); // Obtenemos los datos de la sala.
            
            // Creamos el HTML para la tarjeta de la sala.
            const roomCard = `
                <div class="room-card">
                    <h3>${room.titulo}</h3>
                    <p>Materia: ${room.materia}</p>
                    <div class="room-code">
                        Código: <span>${room.codigoAcceso}</span>
                    </div>
                </div>
            `;
            // Añadimos la tarjeta al contenedor.
            roomsListContainer.innerHTML += roomCard;
        });

    } catch (error) {
        console.error("Error al obtener las salas:", error);
        roomsListContainer.innerHTML = '<p>Ocurrió un error al cargar tus salas.</p>';
    }
};


// --- LÓGICA DE CREACIÓN ---

const handleCreateRoom = async (e, userId) => {
    e.preventDefault();
    const title = createRoomForm['title'].value;
    const subject = createRoomForm['subject'].value;
    const accessCode = generateAccessCode();

    try {
        await addDoc(collection(db, "salas"), {
            titulo: title,
            materia: subject,
            docenteId: userId,
            codigoAcceso: accessCode
        });

        alert(`¡Sala "${title}" creada con éxito!\nCódigo de acceso: ${accessCode}`);
        createRoomForm.reset();
        
        // --- PUNTO CLAVE DE LA ACTUALIZACIÓN ---
        // Después de crear una sala, volvemos a llamar a la función que las muestra
        // para que la lista se actualice en tiempo real, sin recargar la página.
        await displayTeacherRooms(userId);

    } catch (error) {
        console.error("Error al crear la sala:", error);
        alert("Ocurrió un error al crear la sala.");
    }
};


// --- FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
const initializePanel = (userData) => {
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });

    createRoomForm.addEventListener('submit', (e) => handleCreateRoom(e, userData.uid));

    // Finalmente, llamamos a la función para que muestre las salas existentes
    // tan pronto como el panel se inicializa.
    displayTeacherRooms(userData.uid);
};


// --- GUARDIÁN DE RUTA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userUid = user.uid;
        const userDocRef = doc(db, "users", userUid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                userData.uid = userUid;
                if (userData.rol === 'docente') {
                    initializePanel(userData);
                } else {
                    alert("Acceso no autorizado.");
                    window.location.href = 'index.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Error al obtener datos:", error);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});