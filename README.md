<p align="center">
  <img src="./docs/images/readme-header.png" alt="Boxora Smart Locker Frontend" width="100%" />
</p>

<p align="center">
  <img
    src="./docs/images/boxora-header.gif"
    alt="Boxora"
    width="560"
  />
</p>

<p align="center">
  <strong>Language:</strong>
  <a href="./README.vn.md">🇻🇳 Tiếng Việt</a>
  &nbsp;|&nbsp;
  <a href="./README.md">🇬🇧 English</a>
</p>

<h3 align="center">
  🖥️ Web Frontend for SDLMS
</h3>

<p align="center">
  A smart parcel delivery management platform with real-time connectivity and IoT integration.
</p>

<p align="center">
  <img
    src="https://img.shields.io/badge/Frontend-React_18-149ECA?style=flat-square&logo=react&logoColor=white"
    alt="Frontend React 18"
  />
  <img
    src="https://img.shields.io/badge/Backend-.NET_8-512BD4?style=flat-square&logo=dotnet&logoColor=white"
    alt="Backend .NET 8"
  />
  <img
    src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white"
    alt="Database PostgreSQL"
  />
  <img
    src="https://img.shields.io/badge/Realtime-SignalR-512BD4?style=flat-square"
    alt="Realtime SignalR"
  />
  <img
    src="https://img.shields.io/badge/MQTT-EMQX-00B173?style=flat-square"
    alt="MQTT EMQX"
  />
  <img
    src="https://img.shields.io/badge/Hardware-ESP32-E7352C?style=flat-square&logo=espressif&logoColor=white"
    alt="Hardware ESP32"
  />
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-View-2ea44f?style=for-the-badge" alt="Quick Start" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Tech_Stack-View-0969da?style=for-the-badge" alt="Tech Stack" /></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-View-8250df?style=for-the-badge" alt="Architecture" /></a>
  <a href="#related-repositories"><img src="https://img.shields.io/badge/Related_Repos-View-e85d04?style=for-the-badge" alt="Related Repositories" /></a>
  <a href="#development-team"><img src="https://img.shields.io/badge/Development_Team-View-DB2777?style=for-the-badge" alt="Development Team" /></a>
</p>

## Overview

`smart-locking-fe` is the Web frontend of the Boxora system, providing user interfaces for Administrators, Locker Operators, Residents, Shippers.

### Main Interfaces

* **Admin Dashboard** — manages and configures the entire system.
* **Locker Operator Dashboard** — monitors lockers and handles operational tasks.
* **Shipper Guest Web App** — allows parcel drop-off without account registration.
* **Resident Web App** — allows residents to manage and retrieve their parcels.
* **Locker Kiosk** — a touch-optimized interface used directly at the locker.

---

<a id="quick-start"></a>

<details open>
<summary><strong>🚀 Quick Start</strong></summary>

### Requirements

* Node.js:
* Package manager:

### Installation

```bash
git clone https://github.com/se-05-sdlms/smart-locking-fe
cd smart-locking-fe
```

### Configuration

```bash
```

### Run the Development Environment

```bash
# TO BE FILLED IN from the scripts section in package.json
<DEV_COMMAND>
```

* Local URL: your localhost URL
* Demo URL: to be updated

</details>

<a id="tech-stack"></a>

<details open>
<summary><strong>🧰 Tech Stack</strong></summary>

| Category         | Technology                    |
| ---------------- | ----------------------------- |
| Framework        | React 18                      |
| Build tool       | Vite 5.x                      |
| Styling          | Tailwind CSS 4, shadcn/ui     |
| State & realtime | Zustand, `@microsoft/signalr` |
| API & cache      | Axios, TanStack Query 5       |
| Routing          | React Router DOM 6.x          |

</details>

<a id="architecture"></a>

<details open>
<summary><strong>🏗️ Architecture</strong></summary>

```mermaid
flowchart TD
    subgraph Clients["🖥️ Client Layer"]
        direction LR
        A["📱 Resident Mobile App<br/>/ Web App"]
        B["🚚 Shipper Mobile<br/>Web App"]
        C["🏪 Locker Kiosk<br/>Web App"]
        H["🧑‍💼 Admin / Locker Operator<br/>Dashboard"]
    end

    D["⚙️ ASP.NET Core Web API<br/>.NET 8 · JWT · SignalR"]
    DB[("🗄️ PostgreSQL Database<br/>Supabase · Audit Logs")]
    E["📡 EMQX MQTT Broker<br/>MQTT v5.0"]
    F["🔌 ESP32 Locker Controller<br/>ESP32 WROOM 32D"]
    G["🔒 Locker Hardware<br/>Electronic Lock · Relay · Door Sensor"]

    A -->|"(1) HTTPS / REST API / JWT<br/>SignalR Realtime"| D
    B -->|"(1) HTTPS / REST API / JWT<br/>SignalR Realtime"| D
    C -->|"(1) HTTPS / REST API / JWT<br/>SignalR Realtime"| D
    H -->|"(1) HTTPS / REST API / JWT<br/>SignalR Realtime"| D

    D <-->|"(2) Entity Framework Core"| DB
    D <-->|"(3) MQTT Publish / Subscribe<br/>Server-side"| E
    E <-->|"(4) MQTT over Wi-Fi / Internet"| F
    F -->|"(5) Control and read status"| G

    style D fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style E fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style F fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style G fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style DB fill:#f3e8ff,stroke:#9333ea,stroke-width:2px
    style A fill:#eff6ff,stroke:#3b82f6
    style B fill:#eff6ff,stroke:#3b82f6
    style C fill:#eff6ff,stroke:#3b82f6
    style H fill:#eff6ff,stroke:#3b82f6
```

The frontend communicates only with the backend API and SignalR Hub. It does not connect directly to the database, MQTT Broker, or ESP32 devices.

</details>

<details open>
<summary><strong>🔐 Environment Variables</strong></summary>

Create a `.env` file from the project's example environment file.

```env
# TO BE FILLED IN using the exact variable names from the source code
VITE_API_BASE_URL=
VITE_SIGNALR_HUB_URL=
```

Do not store real secrets in the frontend or commit the `.env` file to Git.

</details>

<details>
<summary><strong>🧪 Build, Test, and Lint</strong></summary>

```bash
# TO BE FILLED IN from package.json
<BUILD_COMMAND>
<TEST_COMMAND>
<LINT_COMMAND>
<E2E_COMMAND>
```

</details>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```text
smart-locking-fe/
├── docs/
│   └── images/
│       └── readme-header.png
├── src/
├── public/
├── .env.example
├── package.json
├── README.vn.md
└── README.md
```

</details>

<a id="related-repositories"></a>

<details open>
<summary><strong>🔗 Related Repositories and Documentation</strong></summary>

| Component               | Link                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| GitHub Organization     | [se-05-sdlms](https://github.com/se-05-sdlms)                                                        |
| Backend                 | [smart-locking-be](https://github.com/se-05-sdlms/smart-locking-be)                                  |
| Mobile                  | [smart-locking-mobile](https://github.com/se-05-sdlms/smart-locking-mobile)                          |
| Project Documentation | [Google Drive](https://drive.google.com/drive/folders/1M3OPsm2NxAi7WnAfsKgV4MQEMRy5rOsa?usp=sharing) |

</details>

<a id="development-team"></a>

<details open>
<summary><strong>👥 Development Team</strong></summary>

* **Project code:** `SDLMS`
* **Group:** `SE_05`

### Supervisor

| Full name             | Role       | Email                                       |
| --------------------- | ---------- | ------------------------------------------- |
| MSc. Lê Thị Bích Tra  | Supervisor | [traltb@fe.edu.vn](mailto:traltb@fe.edu.vn) |

### Members

| Student ID | Full name             | Role        | Email                                                             |
| ---------- | --------------------- | ----------- | ----------------------------------------------------------------- |
| DE180519   | Nguyễn Phan Huy       | Team Leader | [huynpde180519@fpt.edu.vn](mailto:huynpde180519@fpt.edu.vn)       |
| DE180405   | Phan Thành Vương      | Member      | [vuongptde180405@fpt.edu.vn](mailto:vuongptde180405@fpt.edu.vn)   |
| DE180313   | Võ Văn Hài            | Member      | [haivvde180313@fpt.edu.vn](mailto:haivvde180313@fpt.edu.vn)       |
| DE180393   | Trần Minh Cường       | Member      | [cuongtmde180393@fpt.edu.vn](mailto:cuongtmde180393@fpt.edu.vn)   |
| DE181072   | Trương Hà Thùy Trang  | Member      | [trangthtde181072@fpt.edu.vn](mailto:trangthtde181072@fpt.edu.vn) |

</details>
