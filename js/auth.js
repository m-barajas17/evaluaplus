// js/auth.js

// Importamos los servicios de auth y db desde nuestro archivo de configuración
import { auth, db } from './firebase-config.js';

// Importamos las funciones específicas que necesitamos de los SDKs de Firebase
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    setDoc,
    // ¡NUEVA IMPORTACIÓN! Necesitamos getDoc para poder leer un documento específico.
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LÓGICA DE REGISTRO (Sin cambios) ---
const registerForm = document.querySelector('#register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = registerForm['name'].value;
        const email = registerForm['email'].value;
        const password = registerForm['password'].value;
        const role = registerForm['role'].value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                nombre: name,
                email: email,
                rol: role
            });

            alert('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
            window.location.href = 'login.html';

        } catch (error) {
            console.error("Error al registrar el usuario:", error);
            alert(`Ocurrió un error: ${error.message}`);
        }
    });
}


// --- LÓGICA DE INICIO DE SESIÓN (¡ACTUALIZADA!) ---
const loginForm = document.querySelector('#login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['email'].value;
        const password = loginForm['password'].value;

        try {
            // 1. Autenticamos al usuario como siempre.
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. ¡NUEVO! Antes de redirigir, consultamos su rol en Firestore.
            // Creamos una referencia directa al documento del usuario usando su UID.
            const userDocRef = doc(db, "users", user.uid);
            // Obtenemos los datos del documento.
            const userDocSnap = await getDoc(userDocRef);

            // 3. Verificamos si el documento existe y tiene datos.
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const userRole = userData.rol; // Obtenemos el campo 'rol'

                // 4. Redirigimos basándonos en el rol.
                if (userRole === 'docente') {
                    alert('¡Bienvenido, Docente!');
                    window.location.href = 'docente.html';
                } else if (userRole === 'estudiante') {
                    alert('¡Bienvenido, Estudiante!');
                    window.location.href = 'estudiante.html';
                } else {
                    // Caso de seguridad por si un usuario no tiene rol asignado.
                    alert('No se pudo determinar tu rol. Redirigiendo a la página principal.');
                    window.location.href = 'index.html';
                }
            } else {
                // Caso de seguridad por si el usuario está autenticado pero no tiene registro en Firestore.
                alert('No se encontraron datos adicionales del usuario.');
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error("Error al iniciar sesión:", error);
            alert(`Error al iniciar sesión: ${error.message}`);
        }
    });
}