/* ===== الإعدادات — المكان الوحيد لعنوان قاعدة البيانات ===== */
const APP_NAME = "شجرة العائلة";
const SUPABASE_URL = "https://lzadmbjhcxqvafykntsp.supabase.co";
const SUPABASE_KEY = "sb_publishable_X4VEzOBLuT8d-b7Tsz9IJQ_1QHW9BIe"; // مفتاح عام — الحماية عبر سياسات RLS
const PHOTO_BUCKET = "f4-photos";
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const COUNTRY_CODE = "973"; // البحرين — لروابط واتساب
const CONTACT_WA = "35603690"; // رقم التواصل مع إدارة البرنامج

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* أنواع القوائم (مقابلة لجداول Access المساعدة t02…t18) */
const LOOKUP_KINDS = {
  governorate:   {label:"المحافظات"},
  area:          {label:"المناطق", parent:"governorate", parentLabel:"المحافظة"},
  branch:        {label:"فروع العائلة"},
  family:        {label:"العائلات"},
  nickname:      {label:"الكنى والألقاب"},
  marital:       {label:"الحالة الاجتماعية"},
  blood:         {label:"فصائل الدم"},
  education:     {label:"المؤهلات العلمية"},
  specialization:{label:"التخصصات"},
  job:           {label:"الوظائف"},
  workside:      {label:"جهات العمل"},
  hobby:         {label:"الهوايات"},
  birthplace:    {label:"أماكن الميلاد"},
  burial:        {label:"أماكن الدفن"},
  nationality:   {label:"الجنسيات"},
};

/* حقول السجل — مقابلة لحقول جدول t01cudata */
const FIELDS = {
  serial:{label:"رقم التسلسل", xl:"رقم التسلسل"},
  cpr:{label:"الرقم الشخصي", xl:"الرقم الشخصي"},
  name1:{label:"الاسم الأول", xl:"الاسم الأول"},
  name2:{label:"اسم الأب", xl:"اسم الأب"},
  name3:{label:"اسم الجد", xl:"اسم الجد"},
  name4:{label:"الجد الثاني", xl:"الجد الثاني"},
  name5:{label:"الجد الثالث", xl:"الجد الثالث"},
  name6:{label:"الجد الرابع", xl:"الجد الرابع"},
  family:{label:"العائلة", lk:"family", free:1, xl:"العائلة"},
  branch:{label:"الفرع", lk:"branch", free:1, xl:"الفرع"},
  affiliation:{label:"الانتساب للعائلة", opts:["من العائلة","منتسب بالزواج"], xl:"الانتساب"},
  nickname:{label:"الكنية / اللقب", lk:"nickname", free:1, xl:"الكنية"},
  gender:{label:"الجنس", opts:["ذكر","أنثى"], xl:"الجنس"},
  nationality:{label:"الجنسية", lk:"nationality", free:1, xl:"الجنسية"},
  marital:{label:"الحالة الاجتماعية", lk:"marital", xl:"الحالة الاجتماعية"},
  birth_date:{label:"تاريخ الميلاد", type:"date", xl:"تاريخ الميلاد"},
  birth_place:{label:"مكان الميلاد", lk:"birthplace", free:1, xl:"مكان الميلاد"},
  blood:{label:"فصيلة الدم", lk:"blood", ltr:1, xl:"فصيلة الدم"},
  phone:{label:"الهاتف", type:"tel", ltr:1, xl:"الهاتف"},
  phone2:{label:"هاتف آخر", type:"tel", ltr:1, xl:"هاتف آخر"},
  email:{label:"البريد الإلكتروني", type:"email", ltr:1, xl:"البريد الإلكتروني"},
  governorate:{label:"المحافظة", lk:"governorate", xl:"المحافظة"},
  area:{label:"المنطقة", lk:"area", xl:"المنطقة"},
  house_no:{label:"رقم المنزل", ltr:1, xl:"رقم المنزل"},
  flat_no:{label:"رقم الشقة", ltr:1, xl:"رقم الشقة"},
  road_no:{label:"رقم الطريق", ltr:1, xl:"رقم الطريق"},
  block_no:{label:"رقم المجمع", ltr:1, xl:"رقم المجمع"},
  education:{label:"المؤهل العلمي", lk:"education", xl:"المؤهل العلمي"},
  specialization:{label:"التخصص", lk:"specialization", free:1, xl:"التخصص"},
  job:{label:"الوظيفة", lk:"job", free:1, xl:"الوظيفة"},
  workside:{label:"جهة العمل", lk:"workside", free:1, xl:"جهة العمل"},
  hobby:{label:"الهواية", lk:"hobby", free:1, xl:"الهواية"},
  status:{label:"الحالة", opts:["على قيد الحياة","متوفى"], xl:"الحالة"},
  death_date:{label:"تاريخ الوفاة", type:"date", xl:"تاريخ الوفاة"},
  burial_place:{label:"مكان الدفن", lk:"burial", free:1, xl:"مكان الدفن"},
  mother_name:{label:"اسم الأم (غير مسجلة)", xl:"اسم الأم"},
  notes:{label:"الملاحظات", type:"textarea", xl:"الملاحظات"},
};
const DATA_COLS = Object.keys(FIELDS).concat(["father_id","mother_id","photo_path"]);

/* رابط البرنامج المنشور — يُستخدم في الروابط المرسلة حتى عند تشغيل النسخة المحلية من الكمبيوتر */
const APP_URL = location.protocol === "file:" ? "./" : location.href.split("#")[0];
