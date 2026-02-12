/**
 * 職員室予定表 (Digital Signage for Staff Room)
 * * Googleカレンダーから特定の予定を取得し、サイネージ表示するためのバックエンドスクリプトです。
 * 機密情報（カレンダーID）は「スクリプトプロパティ」に保存して使用します。
 */

// ■ 設定：環境変数（スクリプトプロパティ）からカレンダーIDを取得
const props = PropertiesService.getScriptProperties();

const CALENDAR_CONFIG = {
  staff:   { id: props.getProperty('CAL_ID_STAFF'),   name: '教職員予定', color: '#4285F4' }, // 青
  student: { id: props.getProperty('CAL_ID_STUDENT'), name: '生徒予定',   color: '#34A853' }, // 緑
  trip:    { id: props.getProperty('CAL_ID_TRIP'),    name: '出張・研修', color: '#EA4335' }  // 赤
};

// 祝日カレンダーID（標準の日本の祝日）
const HOLIDAY_CAL_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

// 祝日扱いしたくない行事名リスト（カレンダーに含まれていても平日として扱う）
const IGNORE_HOLIDAY_KEYWORDS = [
  '節分', '七夕', 'バレンタイン', 'ハロウィン', 'クリスマス', '大晦日', '母の日', '父の日'
];

/**
 * ウェブアプリへのアクセス時に呼ばれる関数
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('職員室予定表')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * フロントエンドから定期的に呼ばれるデータ取得関数
 */
function getData() {
  const targetDate = getTargetDate();
  const events = getAllEvents(targetDate);
  
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayStr = dayNames[targetDate.getDay()];
  const dateStr = Utilities.formatDate(targetDate, 'JST', 'M月d日') + ' (' + dayStr + ')';
  
  return {
    displayDate: dateStr,
    events: events,
    // 変更検知用ハッシュ: イベントの中身と日付を文字列化して連結
    dataHash: JSON.stringify(events) + dateStr 
  };
}

/**
 * 表示対象日を計算する
 * - 17時以降は翌日を表示
 * - 土日祝はスキップして次の平日を表示
 */
function getTargetDate() {
  const now = new Date();
  
  // タイムゾーン対策: サーバー時間ではなく日本時間の「時」を取得
  const hourJST = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'H'));
  
  let target = new Date(now);
  
  // 17時以降なら明日へ
  if (hourJST >= 17) {
    target.setDate(target.getDate() + 1);
  }
  
  // 土日祝（除外リスト適用済）なら平日になるまで進める
  while (isHolidayOrWeekend(target)) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}

/**
 * 土日・祝日判定
 */
function isHolidayOrWeekend(date) {
  // 1. 土日判定
  const dayStr = Utilities.formatDate(date, 'Asia/Tokyo', 'E');
  if (dayStr === 'Sat' || dayStr === 'Sun') return true;
  
  // 2. 祝日カレンダー取得
  const cal = CalendarApp.getCalendarById(HOLIDAY_CAL_ID);
  if (!cal) return false; 

  const events = cal.getEventsForDay(date);
  if (events.length === 0) return false;

  // 3. キーワードフィルター（節分などを除外）
  const validEvents = events.filter(function(e) {
    const title = e.getTitle();
    const isIgnored = IGNORE_HOLIDAY_KEYWORDS.some(keyword => title.indexOf(keyword) !== -1);
    return !isIgnored;
  });
  
  return validEvents.length > 0;
}

/**
 * 全カテゴリのイベントを取得
 */
function getAllEvents(date) {
  const result = {};
  
  Object.keys(CALENDAR_CONFIG).forEach(key => {
    const config = CALENDAR_CONFIG[key];
    let eventList = [];
    
    // プロパティ未設定時のハンドリング
    if (config.id) {
      const calendar = CalendarApp.getCalendarById(config.id);
      if (calendar) {
        const calEvents = calendar.getEventsForDay(date);
        eventList = calEvents.map(e => ({ title: e.getTitle() }));
      }
    }
    
    result[key] = {
      name: config.name,
      color: config.color,
      list: eventList
    };
  });
  
  return result;
}
