<p align="center">
  <img src="./docs/images/readme-header.png" alt="Frontend tủ khóa thông minh Boxora" width="100%" />
</p>

<p align="center">
  <img
    src="./docs/images/boxora-header.gif"
    alt="Boxora"
    width="560"
  />
</p>

<p align="center">
  <strong>Ngôn ngữ:</strong>
  <a href="./README.md">🇻🇳 Tiếng Việt</a>
  &nbsp;|&nbsp;
  <a href="./README.en.md">🇬🇧 English</a>
</p>

<h3 align="center">
  🖥️ Web Frontend của SDLMS
</h3>

<p align="center">
  Nền tảng quản lý giao nhận bưu kiện thông minh, kết nối thời gian thực và tích hợp IoT.
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
  <a href="#quick-start"><img src="https://img.shields.io/badge/B%E1%BA%AFt_%C4%91%E1%BA%A7u_nhanh-Xem-2ea44f?style=for-the-badge" alt="Bắt đầu nhanh" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/C%C3%B4ng_ngh%E1%BB%87-Xem-0969da?style=for-the-badge" alt="Công nghệ" /></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Ki%E1%BA%BFn_tr%C3%BAc-Xem-8250df?style=for-the-badge" alt="Kiến trúc" /></a>
  <a href="#related-repositories"><img src="https://img.shields.io/badge/Repo_li%C3%AAn_quan-Xem-e85d04?style=for-the-badge" alt="Repo liên quan" /></a>
  <a href="#development-team"><img src="https://img.shields.io/badge/Nh%C3%B3m_ph%C3%A1t_tri%E1%BB%83n-Xem-DB2777?style=for-the-badge" alt="Nhóm phát triển"/></a>
</p>

## Tổng quan

`smart-locking-fe` là frontend Web của hệ thống Boxora, cung cấp giao diện cho Quản trị viên, Locker Operator, Cư dân, Shipper.

### Các màn hình chính

* **Dashboard quản trị** — quản trị và cấu hình toàn bộ hệ thống.
* **Dashboard dành cho Locker Operator** — giám sát tủ và xử lý vận hành.
* **Web App khách dành cho Shipper** — gửi bưu kiện không cần đăng ký tài khoản.
* **Web App dành cho cư dân** — quản lý và nhận bưu kiện của cư dân.

---

<a id="quick-start"></a>

<details open>
<summary><strong>🚀 Bắt đầu nhanh</strong></summary>

### Yêu cầu

* Node.js:
* Trình quản lý package:

### Cài đặt

```bash
git clone https://github.com/se-05-sdlms/smart-locking-fe
cd smart-locking-fe
```

### Cấu hình

```bash
```

### Chạy môi trường phát triển

```bash
# NGƯỜI DÙNG CẦN ĐIỀN từ scripts trong package.json
<DEV_COMMAND>
```

* URL local: localhost của bạn
* URL demo: cập nhật sau

</details>

<a id="tech-stack"></a>

<details open>
<summary><strong>🧰 Công nghệ</strong></summary>

| Nhóm             | Công nghệ                     |
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
<summary><strong>🏗️ Kiến trúc</strong></summary>

```mermaid
flowchart TD
    subgraph Clients["🖥️ Tầng Client"]
        direction LR
        A["📱 Mobile App / Web App<br/>dành cho cư dân"]
        B["🚚 Mobile Web App<br/>dành cho Shipper"]
        C["🏪 Web App<br/>dành cho Locker Kiosk"]
        H["🧑‍💼 Dashboard dành cho<br/>Admin / Locker Operator"]
    end

    D["⚙️ ASP.NET Core Web API<br/>.NET 8 · JWT · SignalR"]
    DB[("🗄️ PostgreSQL Database<br/>Supabase · Audit logs")]
    E["📡 EMQX MQTT Broker<br/>MQTT v5.0"]
    F["🔌 ESP32 Locker Controller<br/>ESP32 WROOM 32D"]
    G["🔒 Phần cứng tủ<br/>Khóa điện tử · Relay · Cảm biến cửa"]

    A -->|"(1) HTTPS / REST API / JWT<br/>SignalR thời gian thực"| D
    B -->|"(1) HTTPS / REST API / JWT<br/>SignalR thời gian thực"| D
    C -->|"(1) HTTPS / REST API / JWT<br/>SignalR thời gian thực"| D
    H -->|"(1) HTTPS / REST API / JWT<br/>SignalR thời gian thực"| D

    D <-->|"(2) Entity Framework Core"| DB
    D <-->|"(3) MQTT Publish / Subscribe<br/>Server-side"| E
    E <-->|"(4) MQTT qua Wi-Fi / Internet"| F
    F -->|"(5) Điều khiển và đọc trạng thái"| G

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

Frontend chỉ giao tiếp với backend API và SignalR Hub. Frontend không kết nối trực tiếp tới database, MQTT Broker hoặc thiết bị ESP32.

</details>

<details open>
<summary><strong>🔐 Biến môi trường</strong></summary>

Tạo file `.env` từ file mẫu của dự án.

```env
# NGƯỜI DÙNG CẦN ĐIỀN đúng tên biến từ mã nguồn
VITE_API_BASE_URL=
VITE_SIGNALR_HUB_URL=
```

Không lưu secret thật trong frontend hoặc commit file `.env` lên Git.

</details>

<details>
<summary><strong>🧪 Build, test và lint</strong></summary>

```bash
# NGƯỜI DÙNG CẦN ĐIỀN từ package.json
<BUILD_COMMAND>
<TEST_COMMAND>
<LINT_COMMAND>
<E2E_COMMAND>
```

</details>

<details>
<summary><strong>📁 Cấu trúc dự án</strong></summary>

```text
smart-locking-fe/
├── docs/
│   └── images/
│       └── readme-header.png
├── src/
├── public/
├── .env.example
├── package.json
├── README.en.md
└── README.md
```

</details>

<a id="related-repositories"></a>

<details open>
<summary><strong>🔗 Repo và tài liệu liên quan</strong></summary>

| Thành phần           | Liên kết                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| GitHub Organization  | [se-05-sdlms](https://github.com/se-05-sdlms)                                                        |
| Backend              | [smart-locking-be](https://github.com/se-05-sdlms/smart-locking-be)                                  |
| Mobile               | [smart-locking-mobile](https://github.com/se-05-sdlms/smart-locking-mobile)                          |
| Tài liệu dự án | [Google Drive](https://drive.google.com/drive/folders/1M3OPsm2NxAi7WnAfsKgV4MQEMRy5rOsa?usp=sharing) |

</details>
<a id="development-team"></a>
<details open>
<summary><strong>👥 Nhóm phát triển</strong></summary>

* **Mã dự án:** `SDLMS`
* **Nhóm:** `SE_05`

### Giảng viên hướng dẫn

| Họ và tên            | Vai trò              | Email                                       |
| -------------------- | -------------------- | ------------------------------------------- |
| ThS. Lê Thị Bích Tra | Giảng viên hướng dẫn | [traltb@fe.edu.vn](mailto:traltb@fe.edu.vn) |

### Thành viên

| MSSV     | Họ và tên            | Vai trò     | Email                                                             |
| -------- | -------------------- | ----------- | ----------------------------------------------------------------- |
| DE180519 | Nguyễn Phan Huy      | Trưởng nhóm | [huynpde180519@fpt.edu.vn](mailto:huynpde180519@fpt.edu.vn)       |
| DE180405 | Phan Thành Vương     | Thành viên  | [vuongptde180405@fpt.edu.vn](mailto:vuongptde180405@fpt.edu.vn)   |
| DE180313 | Võ Văn Hài           | Thành viên  | [haivvde180313@fpt.edu.vn](mailto:haivvde180313@fpt.edu.vn)       |
| DE180393 | Trần Minh Cường      | Thành viên  | [cuongtmde180393@fpt.edu.vn](mailto:cuongtmde180393@fpt.edu.vn)   |
| DE181072 | Trương Hà Thùy Trang | Thành viên  | [trangthtde181072@fpt.edu.vn](mailto:trangthtde181072@fpt.edu.vn) |
