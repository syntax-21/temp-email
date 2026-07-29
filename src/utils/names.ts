export const HUMAN_NAMES = [
  // Western / English / North America
  "alex", "jordan", "taylor", "morgan", "casey", "riley", "cameron", "avery", "quinn", "skyler", 
  "ryan", "dylan", "logan", "lucas", "liam", "emma", "olivia", "ava", "sophia", "isabella", 
  "mia", "charlotte", "amelia", "harper", "evelyn", "abigail", "emily", "elizabeth", "sofia", "ella", 
  "oliver", "elijah", "william", "james", "benjamin", "henry", "alexander", "michael", "daniel", "matthew",
  "mason", "ethan", "jackson", "sebastian", "jack", "john", "luke", "wyatt", "levi", "isaac",
  "gabriel", "julian", "mateo", "anthony", "jaxon", "lincoln", "joshua", "christopher", "andrew", "theodore",
  
  // Indonesia
  "budi", "agus", "sri", "ayu", "ratna", "dewi", "eka", "dwi", "tri", "putra",
  "putri", "bayu", "dimas", "rizky", "indah", "sari", "wati", "jaya", "kurniawan", "pratama",
  "setiawan", "wijaya", "hadi", "santoso", "lestari", "wahyuni", "saputra", "susanti", "yulia", "ilham",
  "diana", "rudi", "hendra", "surya", "tiara", "citra", "dinda", "fajar", "gilang", "aditya",
  "bambang", "siti", "eko", "hari", "joko", "ahmad", "yusuf", "kadek", "made", "wayan",
  "nyoman", "ketut", "agung", "wira", "raden", "cahya", "mega", "bintang", "galang", "nanda",
  
  // China
  "wei", "fang", "jian", "hua", "ying", "hui", "ping", "ming", "qiang", "lei",
  "hong", "lin", "yong", "jie", "bin", "yan", "jing", "li", "peng", "hao",
  "min", "xin", "tao", "jun", "feng", "xia", "chen", "wang", "zhang", "liu",
  "zhao", "huang", "zhou", "wu", "xu", "sun", "ma", "zhu", "hu", "guo",
  
  // Japan
  "haruto", "yuto", "sota", "yuki", "hayato", "ren", "hiroshi", "kenji", "takeshi", "ichiro",
  "hina", "yui", "sakura", "ichika", "akari", "yuna", "mio", "rin", "himari", "aoi",
  "kazuo", "shota", "daiki", "kaito", "ryu", "akira", "sayaka", "misaki", "naomi", "ayumi",
  "keiko", "makoto", "satoshi", "takahiro", "yoshio", "nana", "mei", "koharu", "riko", "kanade",
  
  // Korea
  "minho", "jihoon", "seojun", "doyun", "yejun", "siwoo", "haejoon", "jinyoung", "donghae", "taeyang",
  "seoyeon", "jiwoo", "haun", "suyin", "jimin", "yuna", "soomin", "hayoon", "eunji", "minji",
  "jisoo", "taehyung", "jungkook", "seokjin", "namjoon", "hoseok", "yoongi", "hyunjin", "felix", "chaewon",
  "wonyoung", "yujin", "sakura", "karina", "winter", "ningning", "giselle", "ryujin", "yeji", "lia",
  
  // Thailand
  "somchai", "somsak", "arthit", "kitti", "niran", "pravat", "sakda", "surat", "tanawat", "wittaya",
  "mali", "kanya", "anong", "chariya", "kannika", "natcha", "pornpan", "siriporn", "sunisa", "wanida",
  "phawin", "suwit", "thanakorn", "veerachat", "yutthana", "aranya", "busaba", "chinda", "dao", "intira",
  
  // Vietnam
  "anh", "bao", "cuong", "duc", "hai", "hieu", "hoang", "huy", "khoa", "linh",
  "minh", "nam", "phuc", "quan", "son", "thanh", "tuan", "viet", "dung", "phuong",
  "chau", "chi", "diem", "ha", "hoa", "lan", "mai", "ngoc", "nhi", "thu",
  "trieu", "van", "xuan", "yen", "giang", "khanh", "ly", "my", "nga", "phong",
  
  // Malaysia & Singapore (Malay, Chinese, Indian mix)
  "ahmad", "muhammad", "amir", "hafiz", "syed", "zain", "faizal", "azman", "rosli", "ismail",
  "nur", "siti", "fatimah", "aminah", "aishah", "nadia", "farhana", "syahirah", "amalina", "nurul",
  "wei", "jian", "ling", "mei", "hui", "raj", "kumar", "devi", "priya", "anand",
  "firdaus", "hakim", "izzat", "khairul", "luqman", "shafiq", "tengku", "zulfikar", "aliyah", "batrisyia",
  
  // Arabic (Middle East)
  "mohammad", "ahmed", "ali", "omar", "youssef", "tariq", "khalid", "hamza", "hassan", "hussein",
  "ibrahim", "mahmoud", "abdullah", "mustafa", "kareem", "samir", "zaid", "amir", "yaser", "faisal",
  "fatima", "maryam", "aisha", "zainab", "layla", "sara", "noor", "yasmin", "amina", "hana",
  "salma", "dina", "rania", "mona", "farah", "huda", "reem", "lama", "nada", "samira",
  
  // India / South Asia
  "aarav", "vihaan", "vivaan", "anya", "diya", "aditya", "arjun", "sai", "rohan", "rahul",
  "kavya", "priya", "ananya", "ishita", "riya", "shreya", "neha", "sanya", "tanya", "isha",
  "vikram", "karan", "sanjay", "amit", "anil", "sunil", "vinay", "ajay", "vijay", "ashok",
  
  // Latin America / Spain / Portugal
  "santiago", "mateo", "matias", "diego", "sebastian", "nicolas", "alejandro", "samuel", "lucas", "daniel",
  "sofia", "valentina", "isabella", "camila", "martina", "valeria", "luciana", "mariana", "victoria", "gabriela",
  "carlos", "juan", "pedro", "luis", "jose", "manuel", "miguel", "francisco", "javier", "fernando",
  "maria", "ana", "carmen", "laura", "andrea", "claudia", "paula", "marta", "elena", "lucia",
  
  // Europe (French, German, Italian, Russian, etc.)
  "louis", "leo", "gabriel", "arthur", "jules", "emma", "jade", "louise", "chloe", "alice",
  "maximilian", "paul", "leon", "finn", "noah", "mia", "hannah", "sophia", "emilia", "lina",
  "leonardo", "francesco", "alessandro", "lorenzo", "mattia", "aurora", "giulia", "sofia", "ginevra", "alice",
  "alexander", "mikhail", "ivan", "dmitry", "artem", "anastasia", "maria", "daria", "anna", "elizabeth",
  
  // Africa
  "kofi", "kwame", "mensah", "ade", "chidi", "emeka", "obi", "tariq", "zane", "jamal",
  "fatoumata", "aminata", "mariam", "nia", "zara", "aaliyah", "layla", "safiya", "zainab", "habiba",
  "mandla", "sipho", "thabo", "lungile", "zanele", "lerato", "thandiwe", "nkosana", "bongani", "jabulani",
  
  // Pop Culture / Fiction / Mythological (Easter Eggs)
  "thor", "loki", "odin", "freya", "athena", "apollo", "zeus", "hera", "ares", "hermes",
  "gandalf", "frodo", "samwise", "aragorn", "legolas", "gimli", "arwen", "galadriel", "bilbo", "elrond",
  "luke", "leia", "han", "chewie", "yoda", "anakin", "padme", "obiwan", "mando", "grogu"
];
