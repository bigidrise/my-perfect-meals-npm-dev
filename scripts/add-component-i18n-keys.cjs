#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.resolve(__dirname, "../client/src/i18n/locales");

const NEW_KEYS = {
  // WorkspaceChooser
  welcomeBack:       { en:"Welcome Back", es:"Bienvenido de nuevo", fr:"Bienvenue", de:"Willkommen zurück", it:"Bentornato", pt:"Bem-vindo de volta", zh:"欢迎回来", ja:"おかえりなさい", ko:"다시 오신 것을 환영합니다", ar:"مرحباً بعودتك", hi:"वापस स्वागत है", ru:"С возвращением", vi:"Chào mừng trở lại", tl:"Maligayang pagbabalik" },
  whereToTitle:      { en:"Where to?", es:"¿A dónde?", fr:"Où aller ?", de:"Wohin?", it:"Dove andare?", pt:"Para onde?", zh:"去哪里？", ja:"どこへ？", ko:"어디로?", ar:"إلى أين؟", hi:"कहाँ जाएं?", ru:"Куда?", vi:"Đi đâu?", tl:"Saan?" },
  whereToSubtitle:   { en:"Choose how you'd like to start today.", es:"Elige cómo quieres empezar hoy.", fr:"Choisissez comment vous souhaitez commencer aujourd'hui.", de:"Wählen Sie, wie Sie heute beginnen möchten.", it:"Scegli come vuoi iniziare oggi.", pt:"Escolha como gostaria de começar hoje.", zh:"选择今天的开始方式。", ja:"今日のスタート方法を選んでください。", ko:"오늘 어떻게 시작할지 선택하세요.", ar:"اختر كيف تريد البدء اليوم.", hi:"आज शुरू करने का तरीका चुनें।", ru:"Выберите, как хотите начать сегодня.", vi:"Chọn cách bạn muốn bắt đầu hôm nay.", tl:"Piliin kung paano mo gustong magsimula ngayon." },
  personalSpaceDesc: { en:"Your meals, your macros, your life.", es:"Tus comidas, tus macros, tu vida.", fr:"Vos repas, vos macros, votre vie.", de:"Ihre Mahlzeiten, Ihre Makros, Ihr Leben.", it:"I tuoi pasti, i tuoi macro, la tua vita.", pt:"Suas refeições, seus macros, sua vida.", zh:"您的餐食，您的宏量，您的生活。", ja:"あなたの食事、あなたのマクロ、あなたの生活。", ko:"당신의 식사, 당신의 매크로, 당신의 삶.", ar:"وجباتك ومعاييرك وحياتك.", hi:"आपका भोजन, आपके मैक्रो, आपका जीवन।", ru:"Ваши блюда, ваши макросы, ваша жизнь.", vi:"Bữa ăn của bạn, macro của bạn, cuộc sống của bạn.", tl:"Ang iyong mga pagkain, ang iyong mga macro, ang iyong buhay." },
  checkingAccess:    { en:"Checking access...", es:"Verificando acceso...", fr:"Vérification de l'accès...", de:"Zugriff wird geprüft...", it:"Verifica accesso...", pt:"Verificando acesso...", zh:"检查访问权限...", ja:"アクセスを確認中...", ko:"접근 권한 확인 중...", ar:"جارٍ التحقق من الوصول...", hi:"एक्सेस जाँचा जा रहा है...", ru:"Проверка доступа...", vi:"Đang kiểm tra quyền truy cập...", tl:"Sinisuri ang access..." },
  manageClientsIn:   { en:"Manage clients in {{name}}.", es:"Gestiona clientes en {{name}}.", fr:"Gérez les clients dans {{name}}.", de:"Kunden in {{name}} verwalten.", it:"Gestisci i clienti in {{name}}.", pt:"Gerencie clientes em {{name}}.", zh:"在 {{name}} 中管理客户。", ja:"{{name}} でクライアントを管理します。", ko:"{{name}}에서 클라이언트를 관리합니다.", ar:"إدارة العملاء في {{name}}.", hi:"{{name}} में क्लाइंट प्रबंधित करें।", ru:"Управляйте клиентами в {{name}}.", vi:"Quản lý khách hàng trong {{name}}.", tl:"Pamahalaan ang mga client sa {{name}}." },
  // ProfileSheet
  yourPersonalSpace: { en:"Your personal space", es:"Tu espacio personal", fr:"Votre espace personnel", de:"Ihr persönlicher Bereich", it:"Il tuo spazio personale", pt:"Seu espaço pessoal", zh:"您的个人空间", ja:"あなたの個人スペース", ko:"당신의 개인 공간", ar:"مساحتك الشخصية", hi:"आपका व्यक्तिगत स्थान", ru:"Ваше личное пространство", vi:"Không gian cá nhân của bạn", tl:"Ang iyong personal na espasyo" },
  appVersion:        { en:"App version", es:"Versión de la app", fr:"Version de l'app", de:"App-Version", it:"Versione app", pt:"Versão do app", zh:"应用版本", ja:"アプリバージョン", ko:"앱 버전", ar:"إصدار التطبيق", hi:"ऐप संस्करण", ru:"Версия приложения", vi:"Phiên bản ứng dụng", tl:"Bersyon ng App" },
  upToDate:          { en:"Up to date", es:"Actualizado", fr:"À jour", de:"Aktuell", it:"Aggiornato", pt:"Atualizado", zh:"已是最新版本", ja:"最新の状態", ko:"최신 상태", ar:"محدَّث", hi:"अप टू डेट", ru:"Актуально", vi:"Đã cập nhật", tl:"Napapanahon" },
  updateAvailable:   { en:"Update available", es:"Actualización disponible", fr:"Mise à jour disponible", de:"Update verfügbar", it:"Aggiornamento disponibile", pt:"Atualização disponível", zh:"有可用更新", ja:"アップデートあり", ko:"업데이트 가능", ar:"تحديث متاح", hi:"अपडेट उपलब्ध है", ru:"Доступно обновление", vi:"Có bản cập nhật", tl:"May available na update" },
  textSize:          { en:"Text Size", es:"Tamaño del texto", fr:"Taille du texte", de:"Textgröße", it:"Dimensione testo", pt:"Tamanho do texto", zh:"字体大小", ja:"文字サイズ", ko:"텍스트 크기", ar:"حجم النص", hi:"टेक्स्ट का आकार", ru:"Размер текста", vi:"Cỡ chữ", tl:"Laki ng Text" },
  narrationSpeed:    { en:"Narration Speed", es:"Velocidad de narración", fr:"Vitesse de narration", de:"Erzählgeschwindigkeit", it:"Velocità di narrazione", pt:"Velocidade de narração", zh:"旁白速度", ja:"ナレーション速度", ko:"내레이션 속도", ar:"سرعة السرد", hi:"कथन की गति", ru:"Скорость повествования", vi:"Tốc độ đọc", tl:"Bilis ng Narration" },
  privacySecurity:   { en:"Privacy & Security", es:"Privacidad y seguridad", fr:"Confidentialité et sécurité", de:"Datenschutz & Sicherheit", it:"Privacy e sicurezza", pt:"Privacidade e segurança", zh:"隐私和安全", ja:"プライバシーとセキュリティ", ko:"개인 정보 및 보안", ar:"الخصوصية والأمان", hi:"गोपनीयता और सुरक्षा", ru:"Конфиденциальность и безопасность", vi:"Quyền riêng tư & Bảo mật", tl:"Privacy at Seguridad" },
  termsOfService:    { en:"Terms of Service", es:"Términos de servicio", fr:"Conditions d'utilisation", de:"Nutzungsbedingungen", it:"Termini di servizio", pt:"Termos de serviço", zh:"服务条款", ja:"利用規約", ko:"서비스 약관", ar:"شروط الخدمة", hi:"सेवा की शर्तें", ru:"Условия использования", vi:"Điều khoản dịch vụ", tl:"Mga Tuntunin ng Serbisyo" },
  managePrivacy:     { en:"Manage your privacy settings", es:"Gestiona tu configuración de privacidad", fr:"Gérez vos paramètres de confidentialité", de:"Verwalten Sie Ihre Datenschutzeinstellungen", it:"Gestisci le impostazioni sulla privacy", pt:"Gerencie suas configurações de privacidade", zh:"管理您的隐私设置", ja:"プライバシー設定を管理する", ko:"개인 정보 설정 관리", ar:"إدارة إعدادات الخصوصية", hi:"अपनी गोपनीयता सेटिंग प्रबंधित करें", ru:"Управляйте настройками конфиденциальности", vi:"Quản lý cài đặt quyền riêng tư", tl:"Pamahalaan ang iyong mga setting ng privacy" },
  reviewTerms:       { en:"Review our terms and conditions", es:"Revisa nuestros términos y condiciones", fr:"Consultez nos termes et conditions", de:"Prüfen Sie unsere Allgemeinen Geschäftsbedingungen", it:"Rivedi i nostri termini e condizioni", pt:"Revise nossos termos e condições", zh:"查看我们的条款和条件", ja:"利用規約を確認する", ko:"이용 약관 검토", ar:"راجع الشروط والأحكام", hi:"हमारी शर्तें और नियम देखें", ru:"Ознакомьтесь с нашими условиями", vi:"Xem các điều khoản và điều kiện", tl:"Suriin ang aming mga tuntunin at kondisyon" },
  restoreDesc:       { en:"Restore an active subscription on this device", es:"Restaurar una suscripción activa en este dispositivo", fr:"Restaurer un abonnement actif sur cet appareil", de:"Aktives Abonnement auf diesem Gerät wiederherstellen", it:"Ripristina un abbonamento attivo su questo dispositivo", pt:"Restaurar uma assinatura ativa neste dispositivo", zh:"在此设备上恢复有效订阅", ja:"このデバイスでアクティブなサブスクリプションを復元する", ko:"이 기기에서 활성 구독 복원", ar:"استعادة اشتراك نشط على هذا الجهاز", hi:"इस डिवाइस पर सक्रिय सदस्यता पुनर्स्थापित करें", ru:"Восстановить активную подписку на этом устройстве", vi:"Khôi phục đăng ký đang hoạt động trên thiết bị này", tl:"I-restore ang isang aktibong subscription sa device na ito" },
};

const LOCALES = ["en","es","fr","de","it","pt","zh","ja","ko","ar","hi","ru","vi","tl"];

for (const lang of LOCALES) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let added = 0;
  for (const [key, byLang] of Object.entries(NEW_KEYS)) {
    if (!(key in data) && byLang[lang] !== undefined) {
      data[key] = byLang[lang];
      added++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`✅ ${lang}.json — added ${added} keys`);
}
console.log("Done.");
