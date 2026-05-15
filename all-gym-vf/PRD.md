# Documento de Requerimientos del Producto (PRD) - All Gym Management System (VF)

## 1. Visión General del Proyecto

**All Gym (VF)** es una plataforma integral de gestión para gimnasios diseñada para modernizar y centralizar la administración de socios, planes, pagos y seguimiento físico. La aplicación utiliza un stack tecnológico de vanguardia para ofrecer una experiencia premium, rápida y escalable.

---

## 2. Objetivos y Metas

- **Centralización**: Gestionar clientes, membresías y finanzas en un solo lugar.
- **Automatización**: Generar planes nutricionales y rutinas básicas basadas en métricas físicas del cliente de forma automática.
- **Experiencia de Usuario**: Proporcionar una interfaz moderna con navegación rápida (KBar) y soporte para modo oscuro.
- **Transparencia Financiera**: Seguimiento detallado de ingresos y estados de cuenta por cliente.

---

## 3. Usuarios y Roles

La plataforma implementa un Control de Acceso Basado en Roles (RBAC):

- **Administrador**: Acceso total al sistema, gestión de usuarios, finanzas y configuración de planes.
- **Entrenador**: Gestión de perfiles físicos de clientes, visualización de rutinas y progreso.
- **Empleado**: Registro de nuevos clientes, renovación de membresías y control de check-in.
- **Cliente**: Acceso a su propio perfil, estado de membresía y seguimiento de sus métricas de entrenamiento/nutrición.

---

## 4. Requerimientos Funcionales

### 4.1 Gestión de Clientes

- **Registro y Edición**: Formulario detallado que incluye datos personales, contacto de emergencia y perfil físico.
- **Perfil Físico**: Captura de métricas (peso, altura, % grasa, medidas corporales) y cálculo automático de:
  - Meta de consumo de agua.
  - Calorías diarias recomendadas.
  - Distribución de macronutrientes (proteínas, carbohidratos, grasas).
- **Check-in/Asistencia**: Seguimiento de la actividad reciente del socio en el gimnasio.
- **Estado de Membresía**: Indicadores visuales de estado (Activo, Expirado, Inactivo).

### 4.2 Planes y Suscripciones

- **Configuración de Planes**: Gestión de niveles de suscripción con precios y duraciones personalizables.
- **Suscripciones**: Registro de fechas de inicio y fin, con lógica para evitar traslapes.
- **Renovación**: Proceso simplificado para renovar membresías, permitiendo actualizar datos físicos y aplicar descuentos.

### 4.3 Finanzas y Pagos

- **Registro de Transacciones**: Cada suscripción genera un registro de pago asociado.
- **Métodos de Pago**: Soporte para Efectivo (Cash), Tarjeta (Card) y Transferencia.
- **Descuentos**: Capacidad de aplicar descuentos personalizados por transacción.
- **Resumen Financiero**: Dashboard con métricas de ingresos totales y actividad reciente.

### 4.4 Lógica de Fitness (Motor Inteligente)

- **Calculadora Excel-Style**: Motor interno que procesa edad, género, peso y nivel de actividad para determinar el plan nutricional.
- **Generador de Rutinas**: Creación automática de bloques de entrenamiento basados en plantillas predefinidas según el tipo de cuerpo y objetivos.

### 4.5 Interfaz de Usuario (UX)

- **Barra de Comandos (KBar)**: Acceso rápido a cualquier sección del sistema mediante atajos de teclado (`Cmd+K`).
- **Modo Oscuro/Claro**: Soporte nativo para temas visuales.
- **Diseño Premium**: Uso de animaciones fluidas (Motion) y componentes consistentes (Shadcn/UI).

---

## 5. Requerimientos No Funcionales

- **Seguridad**: Autenticación robusta y gestión de sesiones mediante Supabase Auth (SSR).
- **Rendimiento**: Renderizado del lado del servidor (SSR) para carga instantánea de datos críticos.
- **Responsive**: Interfaz adaptable a dispositivos móviles y tablets para su uso en el piso del gimnasio.
- **Escalabilidad**: Arquitectura basada en funciones (Edge Functions) para procesos pesados como creación de usuarios y envío de correos.

---

## 6. Stack Tecnológico

- **Framework**: Next.js 15 (App Router).
- **Lenguaje**: TypeScript.
- **Base de Datos & Auth**: Supabase (PostgreSQL).
- **Estilos**: Tailwind CSS 4 + Shadcn UI.
- **Gestión de Estado**: Zustand.
- **Data Fetching**: TanStack Query v5.
- **Tablas**: TanStack Table v8.
- **Animaciones**: Framer Motion.

---

## 7. Modelo de Datos (Principales Tablas)

- `profiles`: Datos personales y roles.
- `plans`: Definición de membresías disponibles.
- `subscriptions`: Control de tiempo y estado de acceso de los socios.
- `payments`: Registro histórico de ingresos.
- `body_assessments`: Historial de medidas y métricas físicas.
- `training_nutrition_snapshots`: Fotos instantáneas de las recomendaciones nutricionales en el momento de la suscripción.
- `routines`: Planes de entrenamiento asignados.

---

## 8. Flujo del Usuario (Administrador)

1. **Inicio de Sesión**: Autenticación segura.
2. **Dashboard**: Revisión de métricas del día.
3. **Registro de Cliente**: Creación de perfil y asignación de plan inicial.
4. **Evaluación Física**: Ingreso de medidas para generar el plan nutricional inicial.
5. **Seguimiento**: Monitoreo de renovaciones pendientes y asistencia.
