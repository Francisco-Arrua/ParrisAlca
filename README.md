# ParrisAlca 
**Sistema de Gestión y Reserva de Quinchos Municipales**

ParrisAlca es una plataforma web diseñada para organizar el uso de espacios públicos (quinchos/parrillas), optimizando la asistencia mediante validación por QR y Geolocalización.

## Funcionalidades Principales
* **Mapa Interactivo:** Visualización en tiempo real de quinchos disponibles y ocupados.
* **Sistema de Reservas:** Restricciones de turnos (Día/Noche) y límite de 2 días consecutivos.
* **Check-in Inteligente:** Validación de presencia física mediante escaneo de QR y GPS (radio de 200m).
* **Gestor de Sanciones:** Suspensión automática de usuarios por inasistencias repetidas.
* **Responsive Design:** Optimizado para dispositivos móviles para su uso en el predio.

## Stack Tecnológico
* **Frontend:** React.js, Tailwind CSS, Lucide Icons.
* **Backend:** Node.js, Express.
* **Base de Datos:** PostgreSQL / MySQL con Prisma ORM.
* **Seguridad:** Autenticación JWT y encriptación de contraseñas con Bcrypt.

## Requisitos Previos
* [Node.js](https://nodejs.org/) (v16 o superior)
* [PostgreSQL](https://www.postgresql.org/) o una base de datos compatible.
* [ngrok](https://ngrok.com/) (Para pruebas de GPS y cámara en móviles).

## Instalación y Configuración

1. **Clonar el repositorio:**

2. **Configurar el Servidor:**

    cd server
    npm install
    # Crea un archivo .env y configura tu DATABASE_URL
    npx prisma migrate dev
    npm start

3. **Configurar el Cliente:**
   
    cd ../client
    npm install
    npm start

# Cómo realizar el Check-in (Modo Testeo)

*Para probar la validación de ubicación y cámara desde un celular: ***

*Levanta el proyecto localmente. ***

*Abre una terminal y ejecuta: ngrok http 3000.*

*Abre la URL https proporcionada por ngrok en tu celular.*

*Escanea el QR del quincho (asegúrate de estar en las coordenadas correctas para poder testear) ***