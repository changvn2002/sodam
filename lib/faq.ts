/**
 * Câu hỏi thường gặp về Sổ Đám — nguồn sự thật duy nhất cho cả section FAQ
 * hiển thị trên trang chủ (components/seo/InfoSections.tsx) và FAQPage
 * JSON-LD (app/page.tsx). Hai nơi PHẢI dùng chung dữ liệu này để structured
 * data khớp đúng nội dung người dùng nhìn thấy (yêu cầu của Google).
 *
 * Chỉ ghi những điều đúng với app thật, bản không tài khoản: mở sổ bằng mã
 * mời 12 ký tự, ghi lễ bằng tay / giọng nói / ảnh chụp sổ tay, nghĩa vụ trả
 * lễ tự sinh, tổng kết theo sự kiện, xuất/nhập CSV, và giới hạn offline
 * được nói đúng phần thật (hàng chờ ghi lễ trên máy — xem câu 6).
 */
export const FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'Sổ Đám là gì?',
    answer:
      'Sổ Đám là sổ ghi lễ trực tuyến cho các đám của người Việt: đám cưới, đám hỏi, đám tang, đám giỗ, mừng thọ, thôi nôi, đầy tháng, tân gia, khai trương, sinh nhật, mừng tuổi / lì xì và tốt nghiệp. App ghi lại ai đã mừng bao nhiêu, theo dõi phần lễ bạn cần trả lại, và tổng kết thu — trả theo từng sự kiện, thay cho cuốn sổ giấy dễ thất lạc và khó cộng tổng.',
  },
  {
    question: 'Sổ Đám có cần đăng ký tài khoản không? Mở một cuốn sổ như thế nào?',
    answer:
      'Không cần tài khoản, không có đăng nhập. Bạn mở app là tạo được sổ ngay; mỗi cuốn sổ được bảo vệ bằng một mã mời riêng gồm 12 ký tự, tạo ngẫu nhiên ở phía máy chủ. Chỉ ai có mã mời (hoặc đường link chia sẻ chứa mã) mới mở được sổ — nhập sai mã, app báo không tìm thấy sổ. Vì vậy hãy coi mã mời như chìa khóa của cuốn sổ và chỉ chia sẻ trong gia đình.',
  },
  {
    question: 'Làm sao để ghi một khoản tiền mừng?',
    answer:
      'Có ba cách: gõ tay tên người mừng và số tiền; đọc bằng giọng nói — app nghe và tự tách tên cùng số tiền từ câu bạn đọc, ví dụ "anh Tuấn 500 nghìn"; hoặc chụp ảnh trang sổ tay để AI đọc và trích xuất các dòng lễ. Nếu tính năng đọc ảnh chưa được cấu hình AI ở phía máy chủ, app báo lỗi rõ ràng chứ không tự bịa tên hay số tiền.',
  },
  {
    question: 'Phần trả lễ được theo dõi như thế nào?',
    answer:
      'Khi khách mừng ở đám do nhà bạn tổ chức, Sổ Đám tự ghi nhận nghĩa vụ trả lễ tương ứng. Bạn đánh dấu đã trả hoặc bỏ qua từng khoản, xem được khoản nào còn chờ, khoản nào đã đưa quá tay, và đối chiếu với số đã nhận ngay trên bảng tổng kết của sổ.',
  },
  {
    question: 'Cả gia đình dùng chung một cuốn sổ được không?',
    answer:
      'Được — đó là cách Sổ Đám được thiết kế để dùng. Bạn gửi mã mời hoặc bấm nút chia sẻ để lấy đường link có sẵn mã; người thân mở link là vào thẳng cuốn sổ và ghi cùng. Mỗi thiết bị tự nhớ danh sách sổ đã mở trên máy đó, lần sau vào app là thấy lại, không cần tài khoản.',
  },
  {
    question: 'Mất mạng thì có ghi lễ tiếp được không?',
    answer:
      'Được một phần, và app nói rõ phần nào: Sổ Đám cần có mạng để tải app và mở sổ (dữ liệu sổ nằm trên máy chủ, app không chạy hoàn toàn offline). Nhưng nếu app đang mở mà mạng chập chờn hoặc mất hẳn — rất hay gặp ở quê lúc đông khách — bạn vẫn ghi tiếp các khoản lễ mới: khoản ghi được lưu vào hàng chờ ngay trên máy và tự đồng bộ lên sổ khi có mạng trở lại. Hàng chờ chỉ áp dụng cho việc ghi khoản mới; các thao tác sửa, xóa lúc mất mạng sẽ không được phát lại.',
  },
  {
    question: 'Dữ liệu của tôi nằm ở đâu, có lấy ra được không?',
    answer:
      'Dữ liệu sổ, sự kiện và các khoản lễ được lưu trong cơ sở dữ liệu PostgreSQL ở phía máy chủ. Bạn xuất toàn bộ sổ ra file CSV để lưu trữ hoặc in ra giấy, và nhập lại từ CSV khi cần. Sổ Đám còn có danh bạ người thân kèm lịch sử mừng qua lại và cây họ dựng từ quan hệ vợ chồng, cha mẹ, con cái, anh chị em mà bạn ghi trong sổ.',
  },
];
