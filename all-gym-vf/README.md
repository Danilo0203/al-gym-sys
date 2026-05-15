# 🏋️‍♂️ All Gym Management System (VF)

Bienvenido a **All Gym (VF)**, una plataforma moderna de gestión de gimnasios construida con tecnologías de vanguardia para ofrecer una experiencia fluida, rápida y profesional tanto para administradores como para clientes.

## 🚀 Vision General

Este proyecto es una aplicación web full-stack diseñada para centralizar la administración de un gimnasio. Desde el seguimiento de pagos hasta la gestión de membresías y perfiles de clientes, All Gym ofrece una interfaz intuitiva potenciada por el ecosistema más reciente de Next.js y Supabase.

## ✨ Características Principales

- **📊 Panel de Control (Overview):** Visualización de métricas clave, estadísticas de ingresos y actividad reciente.
- **👥 Gestión de Clientes:** Listado completo de socios con búsqueda avanzada, filtrado y edición de perfiles.
- **💳 Sistema de Pagos:** Registro y seguimiento de transacciones, exportación a Excel y estados de cuenta.
- **📋 Planes y Membresías:** Configuración y administración de diferentes niveles de suscripción.
- **🔐 Autenticación Segura:** Manejo de sesiones y roles mediante Supabase Auth (SSR).
- **🌗 Modo Oscuro/Claro:** Interfaz adaptativa con soporte total para temas.
- **⌨️ Barra de Comandos (KBar):** Navegación ultrarrápida mediante atajos de teclado.

## 🛠️ Stack Tecnológico

El proyecto utiliza lo último en desarrollo web para asegurar rendimiento y escalabilidad:

| Componente        | Tecnología                                                                       |
| :---------------- | :------------------------------------------------------------------------------- |
| **Framework**     | [Next.js 15+](https://nextjs.org/) (App Router)                                  |
| **Lenguaje**      | [TypeScript](https://www.typescriptlang.org/)                                    |
| **Backend & DB**  | [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage)                  |
| **Estilos**       | [Tailwind CSS 4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) |
| **Estado Local**  | [Zustand](https://zustand-demo.pmnd.rs/)                                         |
| **Data Fetching** | [TanStack Query v5](https://tanstack.com/query/latest)                           |
| **Tablas**        | [TanStack Table v8](https://tanstack.com/table/latest)                           |
| **Formularios**   | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)        |
| **Animaciones**   | [Motion](https://motion.dev/) (Framer Motion)                                    |

## 📁 Estructura del Proyecto

```text
src/
├── app/              # Rutas y layouts (Next.js App Router)
├── components/       # Componentes de UI compartidos (Shadcn)
├── features/         # Lógica de negocio dividida por dominios (payments, customers, etc.)
├── hooks/            # Hooks personalizados y lógicas de estado
├── lib/              # Configuraciones de clientes (Supabase, Utils)
├── providers/        # Proveedores de contexto (QueryClient, Theme)
└── types/            # Definiciones de tipos TypeScript globales
```

## ⚙️ Configuración del Entorno

Para ejecutar este proyecto localmente, asegúrate de tener las siguientes variables en tu archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

## 🚀 Inicio Rápido

1.  **Clonar el repositorio:**

    ```bash
    git clone [url-del-repo]
    cd all-gym-vf
    ```

2.  **Instalar dependencias:**

    ```bash
    npm install
    ```

3.  **Ejecutar el servidor de desarrollo:**

    ```bash
    npm run dev
    ```

4.  **Abrir en el navegador:**
    Visita [http://localhost:3000](http://localhost:3000).

---

Desarrollado con ❤️ para la gestión profesional de fitness.
