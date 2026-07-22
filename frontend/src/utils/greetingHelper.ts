// Helper for Sundanese & Indonesian dynamic daily login greetings

export interface GreetingConfig {
  firstLogin: string[];
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  weekend: string[];
}

export const DAILY_GREETINGS: GreetingConfig = {
  firstLogin: [
    "Wilujeng sumping dulur! Hari pertama kerja, gaskeun ulah kendor nya!",
    "Selamat datang karyawan baru! Tetep kalem, ulah spaneng di hari pertama.",
    "Hore anggota anyar! Wilujeng gabung, ngopi heula ben semangat!"
  ],
  monday: [
    "Wilujeng dinten Senen! Ulah males, gaskeun ngarah boga tabungan!",
    "Semangat hari Senin! Hayu urang gawe deui ngarah tiasa jajan enak.",
    "Senen teuleum ku semangat! Login deui euy, gaskeun laporanna!",
    "Senin ceria! Semangat nyambut awal minggu, ulah lemes nya!"
  ],
  tuesday: [
    "Wilujeng dinten Salasa! Pekerjaan tos mulai mengalir lancar euy.",
    "Selasa ceria! Login kesepuluh hari ini? Tetep semangat urang Sunda mah!",
    "Halow! Salasa kie mah kedah tetep produktif tapi tetep santuy nya.",
    "Salasa berkah! Hayu tuntaskan tugas dinten ayeuna!"
  ],
  wednesday: [
    "Wilujeng dinten Rebo! Satengah jalan deui menuju akhir pekan, gaskeun!",
    "Rabu ceria! Jangan lupa ngopi heula ngarah uteukna teu spaneng.",
    "Rebo sore siap-siap, login deui euy! Hayu tuntaskan tugasna.",
    "Rabu manis! Tetep fokus, minggu iki tos satengah jalan!"
  ],
  thursday: [
    "Wilujeng dinten Kemis! Enjing tos Jumaah, ulah kendor semangatna!",
    "Kamis manis! Nyantai saeutik tapi target tetep kahontal nya.",
    "Kemis malam jumat heulaan, hayu urang bereskeun gawean ayeuna!",
    "Kamis produktif! Sakedap deui akhir pekan euy!"
  ],
  friday: [
    "Wilujeng dinten Jumaah! Jumaah berkah, siap-siap nampi akhir pekan!",
    "Jumat Ceria! Gawean tos tuntas durung? Hayu urang gaskeun heula!",
    "TGIF euy! Login jumat kie mah aura akhir pekan tos berasa pisan!",
    "Jumat penuh berkah! Bereskeun tugas ngarah akhir pekan tenang!"
  ],
  weekend: [
    "Wilujeng akhir pekan! Ngalembur euy? Mantap pisan dedikasina!",
    "Sabtu/Minggu tetep login? Tetep semangat dulur, rezeki moal kaliru!",
    "Akhir pekan tetep produktif! Ulah hilap istirahat nya!"
  ]
};

export const getDynamicLoginGreeting = (fullName?: string, isFirstTime: boolean = false): string => {
  const name = fullName ? fullName.split(' ')[0] : 'Dulur';
  
  if (isFirstTime) {
    const list = DAILY_GREETINGS.firstLogin;
    const msg = list[Math.floor(Math.random() * list.length)];
    return `${msg} (Selamat Datang, ${name}!)`;
  }
  
  const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  let dayList: string[] = [];
  
  switch (day) {
    case 1:
      dayList = DAILY_GREETINGS.monday;
      break;
    case 2:
      dayList = DAILY_GREETINGS.tuesday;
      break;
    case 3:
      dayList = DAILY_GREETINGS.wednesday;
      break;
    case 4:
      dayList = DAILY_GREETINGS.thursday;
      break;
    case 5:
      dayList = DAILY_GREETINGS.friday;
      break;
    case 0:
    case 6:
    default:
      dayList = DAILY_GREETINGS.weekend;
      break;
  }
  
  const randomMsg = dayList[Math.floor(Math.random() * dayList.length)];
  return `${randomMsg} (Wilujeng Sumping, ${name}!)`;
};
