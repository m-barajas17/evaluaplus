// js/estudiante.js

// Importamos los servicios de Firebase que vamos a necesitar.
// onAuthStateChanged para saber si hay una sesión activa.
// signOut para el botón de cerrar sesión.
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importamos las funciones de Firestore para consultar la base de datos.
// doc y getDoc para leer el documento del usuario.
// collection, query, where, getDocs para buscar la sala por su código.
import { 
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// --- PASO 3: REFERENCIAS A ELEMENTOS DEL DOM ---
// Obtenemos las referencias a los elementos HTML con los que vamos a interactuar.
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const joinRoomForm = document.getElementById('join-room-form');


// --- PASO 4: LÓGICA PRINCIPAL ---

// Función que se ejecutará cuando el estudiante intente unirse a una sala.
const handleJoinRoom = async (e) => {
    // 1. Prevenimos que el formulario recargue la página.
    e.preventDefault();
    
    // 2. Obtenemos el código que el usuario escribió, lo limpiamos de espacios
    //    y lo convertimos a mayúsculas para que coincida con el formato de la BD.
    const roomCode = joinRoomForm['room-code'].value.trim().toUpperCase();

    // 3. Verificamos que el código no esté vacío.
    if (!roomCode) {
        alert("Por favor, ingresa un código de sala.");
        return;
    }

    // 4. Creamos una consulta a la colección 'salas'.
    //    Usamos 'where' para filtrar los documentos y encontrar aquel
    //    cuyo campo 'codigoAcceso' sea exactamente igual al que ingresó el usuario.
    const q = query(collection(db, "salas"), where("codigoAcceso", "==", roomCode));

    try {
        // 5. Ejecutamos la consulta.
        const querySnapshot = await getDocs(q);

        // 6. Analizamos el resultado.
        if (querySnapshot.empty) {
            // Si 'empty' es true, no se encontró ningún documento. El código es incorrecto.
            alert("Código incorrecto. No se encontró ninguna sala, por favor verifica el código.");
        } else {
            // Si no está vacío, significa que encontramos la sala.
            // Obtenemos la información de la sala del primer (y único) documento.
            const roomDoc = querySnapshot.docs[0];
            const roomData = roomDoc.data();
            
            // Mostramos el mensaje de éxito. En el futuro, esto nos llevará a la evaluación.
            alert(`¡Te has unido a la sala "${roomData.titulo}" con éxito!`);
            
            // Limpiamos el formulario.
            joinRoomForm.reset();
        }
    } catch (error) {
        // Si algo sale mal con la conexión a Firebase, mostramos un error.
        console.error("Error al buscar la sala:", error);
        alert("Ocurrió un error al intentar unirse a la sala. Inténtalo de nuevo.");
    }
};


// --- PASO 3: FUNCIÓN DE INICIALIZACIÓN DEL PANEL ---
// Esta función configura los elementos básicos del panel una vez que hemos
// verificado que el usuario es un estudiante.
const initializePanel = (userData) => {
    // Mostramos el nombre del estudiante en el encabezado.
    userNameElement.textContent = `Bienvenido, ${userData.nombre}`;

    // Configuramos el botón de cerrar sesión.
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // Al cerrar sesión, lo redirigimos a la página de login.
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });

    // Añadimos el 'escuchador' de eventos al formulario para que llame a
    // nuestra función 'handleJoinRoom' cuando se envíe.
    joinRoomForm.addEventListener('submit', handleJoinRoom);
};


// --- PASO 2: GUARDIÁN DE RUTA ---
// Esta es la primera pieza de lógica que se ejecuta. Protege la página.
onAuthStateChanged(auth, async (user) => {
    // Primero, verificamos si hay un usuario con sesión iniciada.
    if (user) {
        // Si hay sesión, obtenemos su UID.
        const userUid = user.uid;
        // Creamos una referencia a su documento en la colección 'users'.
        const userDocRef = doc(db, "users", userUid);
        
        try {
            // Intentamos obtener el documento.
            const userDocSnap = await getDoc(userDocRef);

            // Verificamos si el documento realmente existe.
            if (userDocSnap.exists()) {
                // Si existe, obtenemos sus datos.
                const userData = userDocSnap.data();
                
                // ¡La comprobación clave! Verificamos que su rol sea 'estudiante'.
                if (userData.rol === 'estudiante') {
                    // Si es un estudiante, todo está en orden.
                    // Llamamos a la función que inicializa el panel.
                    initializePanel(userData);
                } else {
                    // Si el rol no es 'estudiante' (podría ser 'docente'), le negamos el acceso.
                    alert("Acceso no autorizado. Esta página es solo para estudiantes.");
                    window.location.href = 'index.html';
                }
            } else {
                // Si el documento no existe por alguna razón, lo tratamos como un error
                // y lo enviamos al login.
                console.error("No se encontró el documento del usuario en Firestore.");
                window.location.href = 'login.html';
            }
        } catch (error) {
            // Si hay un error al intentar leer el documento, lo notificamos y enviamos al login.
            console.error("Error al obtener los datos del usuario:", error);
            window.location.href = 'login.html';
        }
    } else {
        // Si 'user' es null, no hay sesión iniciada. Redirigimos directamente al login.
        window.location.href = 'login.html';
    }
});