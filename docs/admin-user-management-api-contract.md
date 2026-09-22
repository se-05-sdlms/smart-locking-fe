# Kết nối User Management local

Đối chiếu Swagger `http://localhost:5005/swagger/v1/swagger.json` và source backend ngày 2026-09-22. Yêu cầu tích hợp mới thay thế giới hạn mock-only trong tài liệu yêu cầu cũ. Không thay đổi backend, dependency hoặc layout.

## Contract đã xác nhận

Nguồn: `UsersController.cs`, `LockersController.cs`, DTOs `Users`, `Lockers/LockerSummaryResponse.cs`, `Common/PagedResult.cs`, `UserService.cs`, `LockerService.cs`, `IdentityEnums.cs`, `OperatorAssignmentConfiguration.cs` trong backend.

| Chức năng | Endpoint / DTO | Tích hợp |
| --- | --- | --- |
| Danh sách | `GET /api/Users?Role=2&PageNumber=1&PageSize=100` → `{items,totalCount,pageNumber,pageSize}` | Có; Resident dùng Role=1 |
| Chi tiết | `GET /api/Users/{id}` → `UserDetailResponse` | Có |
| Khóa/mở khóa | `PUT /api/Users/{id}/status` với `{status:2 hoặc 0,reason:string}` → `UserDetailResponse` | Có; lý do lấy nhãn tiếng Việt hiện có hoặc chi tiết OTHER |
| Danh sách tủ | `GET /api/Lockers` → `LockerSummaryResponse[]` | Có trong các modal User Management; không đổi trang quản lý Locker riêng |
| Xem phân công | `UserDetailResponse.assignments[]`, chỉ lấy `revokedAt === null` | Có; ghép với danh sách tủ |
| Tạo Operator | `POST /api/Users`: `{fullName,email,phoneNumber,role,password,lockerId,assignmentReason}` → `CreateUserResponse` | Có: role=2, password=null; chỉ lấy id từ response, tải lại chi tiết |
| Thêm phân công | `POST /api/Users/{id}/assignments`: `{lockerId,reason}` → `OperatorAssignmentResponse` | Có, từng tủ thêm mới |
| Thu hồi | `DELETE /api/Users/{id}/assignments/{assignmentId}?reason=...` → 204 | Có, dùng ID bản ghi assignment đang hiệu lực |

Users yêu cầu policy Administrator; Lockers cho Administrator/LockerOperator, Admin đọc toàn bộ. GET/PUT/POST User thành công trả 200. Controller trả 400/404/409 với `{message}`; middleware có thể trả 401/403. Swagger thiếu schema response nên DTO lấy từ implementation, không suy luận từ tên endpoint.

## Mapping

| Frontend | Backend |
| --- | --- |
| `LOCKER_OPERATOR`, `RESIDENT` | Numeric enum `2`, `1` (không dùng chuỗi role của auth) |
| `ACTIVE`, `LOCKED` | Numeric enum `0`, `2` |
| `id`, `fullName`, `email`, `phoneNumber`, `createdAt` | Cùng tên; contact null thành chuỗi rỗng để tương thích view |
| Resident `registeredAt` | `createdAt` của tài khoản |
| `assignedLockerCount` | List `activeAssignmentsCount`; detail đếm assignments chưa thu hồi |
| `avatarUrl` | Có trong detail; list không có, dùng Avatar fallback hiện tại |
| `employeeCode` | Không có; chỉ hiển thị `Chưa có dữ liệu`, không tự tạo mã |
| Locker `locationLabel` | `address` |
| Locker `buildingName` | Không có; hiển thị `Chưa có dữ liệu` |
| Locker `assignedOperatorId` | Ghép ID Operator từ assignments còn hiệu lực; không suy ra từ count |

Search/filter/sort thực hiện trên tất cả trang đã tải của role, sau đó mới phân trang view. Backend chỉ sort theo CreatedAt và giới hạn 100 bản ghi/trang nên không sort riêng từng trang backend. Sort ổn định theo ID khi bằng nhau, ngày không hợp lệ xếp cuối. Mỗi lần tải có giới hạn toàn bộ 20 giây và tối đa 100 trang; lỗi khi không tải đầy đủ, không hiển thị dữ liệu một phần như danh sách đầy đủ. Danh sách thay đổi số lượng/ID trùng giữa các trang yêu cầu tải lại. Backend chưa có snapshot/cursor nên không thể bảo đảm snapshot tuyệt đối khi có ghi đồng thời.

Client hiện có quản lý Bearer/refresh/401/403 và timeout mỗi request. Service bổ sung lỗi tiếng Việt an toàn, không hiển thị raw error payload. Khóa/mở khóa kiểm tra lại role/status, yêu cầu lý do, chặn request trùng cho cùng tài khoản, và sử dụng audit/revoke refresh-token của backend. Lỗi mạng sau PUT có thể không xác định được kết quả ghi: tải lại trước khi thử lại; không tự rollback.

## Ghi dữ liệu qua API hiện có

Theo yêu cầu tiếp tục tích hợp, hai blocker tạm chặn toàn bộ tạo tài khoản/lưu phân công đã được bỏ. Không thay đổi auth, dependency hoặc backend.

- Tạo Operator chuẩn hóa họ tên/email/điện thoại, giữ validation hiện tại. Nếu chọn tủ, kiểm tra lại tồn tại/chủ sở hữu trước khi POST. Tủ đầu tiên đi trong `lockerId` của request tạo; các tủ còn lại dùng POST assignment. Không gửi `lockerIds`, `avatarUrl` hoặc field không có trong DTO.
- Lưu phân công đọc lại detail, so sánh tập ID mong muốn với assignment active. Chỉ tải mới chủ sở hữu tủ trước khi thêm phân công; bỏ phân công/no-op không quét tất cả Operator. Chỉ POST phần thêm và DELETE phần bỏ, tuần tự; no-op không ghi. Thêm trước, bỏ sau. Sau đó đọc mới detail của Operator để xác nhận kết quả và count, rồi UI tải lại danh sách. Luồng tạo dùng lại kiểm tra chủ sở hữu ngay trước POST tạo, không quét lặp sau từng bước.
- Giới hạn mỗi tác vụ mutation 60 giây, request vẫn dùng timeout của api-client. Chặn submit trùng bằng ref ở modal và khóa create/assignment trong service của tab. Input không đổi khi đang gửi; thông tin tài khoản đã tạo không chỉnh sửa trong lần thử lại phân công.
- Nếu lỗi sau khi bắt đầu ghi, trả lỗi tiếng Việt và yêu cầu tải lại dữ liệu thật. Modal assignment tải lại snapshot, giữ thông báo và bỏ bản nháp cũ. Không báo thành công toàn bộ hoặc tự tạo giao dịch rollback giả.
- Nếu tạo tài khoản thành công nhưng phân công/readback lỗi, failure chỉ giữ `createdOperatorId` và cờ `reloadRequired`. Gửi lại cùng biểu mẫu tiếp tục trên ID đó, không POST thêm User; danh sách tủ gồm cả tủ đã thuộc tài khoản vừa tạo. Nếu mất response tạo, chưa biết ID, biểu mẫu yêu cầu đóng/kiểm tra danh sách trước khi gửi lại. Các cờ này là nội bộ frontend, không gửi vào DTO backend.

## Giới hạn backend còn lại

- `Disabled=1` khác `Locked=2`. Không tự chuyển nghĩa hoặc mở lại tài khoản Disabled. Nếu có trong tập kết quả, hiển thị service error rõ ràng; filter Active/Locked vẫn đọc được. Cần thống nhất UI/contract cho Disabled.
- Backend vẫn sinh/trả `temporaryPassword`; frontend không truy cập thuộc tính này, không lưu hoặc hiển thị mật khẩu. Tạo tài khoản được nối, nhưng việc bàn giao mật khẩu/kích hoạt và đổi mật khẩu lần đầu vẫn pending phía backend.
- Chưa có endpoint lưu avatar hay field mã nhân viên. Có chọn avatar thì báo validation trước khi ghi để tránh âm thầm bỏ ảnh; tạo không ảnh vẫn hoạt động. Không tự sinh mã nhân viên.
- Assignment backend chỉ kiểm tra trùng theo cặp Operator–Locker; unique index cũng theo cặp, không ngăn cùng Locker thuộc hai Operator. Các POST/DELETE riêng lẻ có thể thành công một phần. Frontend kiểm tra trước/sau nhưng không thể bảo đảm tính nguyên tử hay độc quyền khi nhiều client ghi đồng thời; cần BE bổ sung transaction batch + unique LockerId cho assignment active.
- Xem nhóm tủ cần đọc chi tiết các Operator có `activeAssignmentsCount > 0`, tối đa 3 request song song. Nếu phát hiện nhiều chủ cho một tủ hoặc thiếu tủ được phân công, báo lỗi thay vì tự chọn chủ. Với dữ liệu lớn vẫn cần endpoint tổng hợp assignment; giảm request không thay thế giới hạn phía server.
- Không trộn mock trong service production. Mock cũ giữ nguyên cho kiểm thử riêng; chỉ API đọc audit chưa được hỗ trợ.

## Sửa lỗi giới hạn request

- Modal chi tiết chỉ đọc người được chọn và danh mục tủ nếu cần, không tải assignment toàn bộ Operator.
- Gộp GET đang chạy cùng URL và cache trong bộ nhớ 10 giây để search/filter/sort/pagination không tải lại liên tục; debounce search 250 ms. Mutation xóa cache người liên quan/danh sách, kiểm tra trước ghi và readback dùng dữ liệu mới. Retry chủ động xóa cache. Đổi danh tính/quyền hoặc logout xóa cache; refresh cùng tài khoản không hủy request đang chạy.
- `429` có thông báo tiếng Việt và thời gian chờ. Source middleware không trả `Retry-After`, nên frontend dùng khoảng nghỉ dự phòng 60 giây, không tự retry mutation. Đây không phải xác nhận giá trị cấu hình rate limit đang chạy; không đọc appsettings.
- `409` khi email/điện thoại trùng là validation backend, không tự bỏ qua hoặc nhận một tài khoản trùng làm kết quả tạo mới.

## Kiểm thử

`node --test --test-isolation=none tests/user-management-service.test.cjs` dùng TypeScript cài sẵn và fixture API biệt lập: tạo 0/1/nhiều tủ, validate/trùng, thêm/bỏ/no-op, soft revoke theo assignmentId, lỗi giữa chừng, mất response, readback lỗi/sai, retry cùng tài khoản và chống gửi trùng. Bổ sung kiểm tra gộp GET/cache, đổi phiên, hủy request độc lập, khoảng nghỉ 429 và số request cho workflow với 20 Operator. Đây không phải dữ liệu seed thật.

Swagger local truy cập được; GET Users/Lockers không có phiên trả 401. Không có công cụ điều khiển phiên trình duyệt đăng nhập nên chưa chạy mutation trực tiếp trên seed. Người dùng đăng nhập Admin tại `http://localhost:5173`, rồi chạy trong console của chính tab đó:

```js
await (await import('/tests/user-management-local-smoke.mjs')).runLocalUserManagementSmoke()
```

Script chỉ cho phép frontend localhost:5173/backend localhost:5005, dùng api-client hiện có. Nó lấy tối đa hai tủ trống từ dữ liệu seed, tạo **một tài khoản kiểm thử**, xác nhận list/detail, bỏ/phân công lại và bỏ phân công của tài khoản thử khi kết thúc. Kiểm tra trùng chỉ chạy khi truyền `{ testDuplicate: true }`; HTTP 409 trong bước đó là kết quả mong đợi. Nếu seed không có tủ trống, báo rõ chưa test ghi assignment. Tài khoản thử vẫn còn vì backend không có endpoint xóa User. Script chỉ trả báo cáo và ID tài khoản thử; không in token/password/Authorization hoặc response gốc. Script không tự chạy khi mở UI.

Ảnh kiểm thử local của người dùng cho thấy bản cũ bị 429 và chưa cleanup được. Bản sửa chưa được chạy lại trên phiên Admin thật. Khi gặp 429, script không gửi cleanup ngay; chờ hết thời gian báo rồi gọi `cleanupLocalUserManagementSmoke(createdOperatorId)` từ cùng module. Hàm này kiểm tra tài khoản có đúng dấu nhận diện smoke test trước khi bỏ phân công; không xóa tài khoản hoặc sửa dữ liệu người dùng khác.
