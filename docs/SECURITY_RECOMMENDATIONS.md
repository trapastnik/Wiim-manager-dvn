# 🔒 Рекомендации по улучшению безопасности WiiM Control Center

## 📋 Обзор текущих уязвимостей

После анализа кода выявлены следующие проблемы безопасности:

### 🔴 Критические уязвимости:
1. **Отсутствие аутентификации** - все API endpoints открыты
2. **Нет валидации входных данных** - возможны инъекции
3. **Path Traversal** - уязвимость в загрузке файлов
4. **Отсутствие rate limiting** - риск DDoS атак
5. **CORS открыт для всех** - доступ из любых источников

### 🟡 Средние уязвимости:
6. **Нет HTTPS на сервере** - трафик передается открыто
7. **Неограниченное сканирование сети** - можно сканировать любую подсеть
8. **Слабая обработка ошибок** - раскрытие внутренней информации
9. **Нет санитизации данных** - возможны XSS атаки
10. **Отсутствие логирования** - нет аудита безопасности

---

## 🛡️ РЕШЕНИЯ ПО ПРИОРИТЕТАМ

### 1. 🔐 АУТЕНТИФИКАЦИЯ И АВТОРИЗАЦИЯ

#### 1.1 Базовая HTTP аутентификация (Простое решение)

**Реализация:**
```javascript
// middleware/auth.js
import { createHash } from 'crypto';

const users = new Map(); // В продакшене использовать БД

// Простая проверка пароля
function verifyPassword(password, hash) {
  const hashed = createHash('sha256').update(password).digest('hex');
  return hashed === hash;
}

// Middleware для проверки аутентификации
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64')
    .toString('utf-8')
    .split(':');
  
  const [username, password] = credentials;
  
  // Проверка учетных данных
  const user = users.get(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.user = user;
  next();
}
```

**Использование:**
```javascript
import { requireAuth } from './middleware/auth.js';

// Защита всех API endpoints
app.use('/api', requireAuth);

// Или выборочно
app.post('/api/players/scan', requireAuth, async (req, res) => {
  // ...
});
```

#### 1.2 JWT аутентификация (Рекомендуется)

**Установка:**
```bash
npm install jsonwebtoken bcrypt
```

**Реализация:**
```javascript
// middleware/jwt-auth.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Генерация токена
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware для проверки JWT
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Хеширование паролей
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

**API для входа:**
```javascript
// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Проверка учетных данных
  const user = await getUserByUsername(username);
  if (!user || !await comparePassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, username: user.username } });
});
```

#### 1.3 Опциональная аутентификация (Гибкое решение)

**Конфигурация:**
```javascript
// .env
AUTH_ENABLED=true
AUTH_METHOD=jwt  # или 'basic'
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password_here
```

**Реализация:**
```javascript
// middleware/auth-optional.js
export function optionalAuth(req, res, next) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  
  if (!authEnabled) {
    req.user = { id: 'guest', role: 'guest' };
    return next();
  }
  
  // Проверка аутентификации
  requireAuth(req, res, next);
}
```

---

### 2. 🚫 RATE LIMITING

**Установка:**
```bash
npm install express-rate-limit
```

**Реализация:**
```javascript
import rateLimit from 'express-rate-limit';

// Общий лимит для всех API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов за 15 минут
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Строгий лимит для критических операций
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 5, // 5 запросов в минуту
  message: 'Too many requests, please slow down.',
});

// Лимит для сканирования сети
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // 3 сканирования в час
  message: 'Network scanning is rate limited. Please try again later.',
});

app.use('/api', apiLimiter);
app.post('/api/players/scan', scanLimiter, async (req, res) => {
  // ...
});

app.post('/api/media/upload', strictLimiter, upload.single('file'), (req, res) => {
  // ...
});
```

---

### 3. ✅ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ

**Установка:**
```bash
npm install express-validator
```

**Реализация:**
```javascript
import { body, param, validationResult } from 'express-validator';

// Middleware для обработки ошибок валидации
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Валидация IP адреса
const validateIP = [
  body('ip')
    .matches(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
    .withMessage('Invalid IP address format'),
  handleValidationErrors
];

// Валидация подсети для сканирования
const validateSubnet = [
  body('subnet')
    .optional()
    .matches(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){2}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
    .withMessage('Invalid subnet format (e.g., 192.168.1)')
    .custom((value) => {
      // Ограничение на сканирование только локальных подсетей
      const allowedSubnets = ['192.168', '10.0', '172.16'];
      const isAllowed = allowedSubnets.some(subnet => value.startsWith(subnet));
      if (!isAllowed) {
        throw new Error('Only local network subnets are allowed');
      }
      return true;
    }),
  handleValidationErrors
];

// Валидация громкости
const validateVolume = [
  body('volume')
    .isInt({ min: 0, max: 100 })
    .withMessage('Volume must be between 0 and 100'),
  handleValidationErrors
];

// Использование
app.post('/api/players', validateIP, async (req, res) => {
  // ...
});

app.post('/api/players/scan', validateSubnet, scanLimiter, async (req, res) => {
  // ...
});

app.post('/api/volume/set', validateVolume, async (req, res) => {
  // ...
});
```

---

### 4. 🛡️ ЗАЩИТА ОТ PATH TRAVERSAL

**Проблема в текущем коде:**
```javascript
// ОПАСНО: нет проверки пути
app.post('/api/media/play', async (req, res) => {
  const { fileUrl } = req.body;
  // fileUrl может быть "../../../etc/passwd"
});
```

**Решение:**
```javascript
import path from 'path';
import { existsSync } from 'fs';

// Функция для безопасной проверки пути
function isPathSafe(filePath, baseDir) {
  const resolvedPath = path.resolve(baseDir, filePath);
  const resolvedBase = path.resolve(baseDir);
  return resolvedPath.startsWith(resolvedBase);
}

// Валидация URL файла
const validateFileUrl = [
  body('fileUrl')
    .notEmpty()
    .withMessage('File URL is required')
    .custom((value) => {
      // Проверка на path traversal
      if (value.includes('..') || value.includes('//')) {
        throw new Error('Invalid file path');
      }
      
      // Если это локальный файл
      if (value.startsWith('/media/')) {
        const filePath = value.replace('/media/', '');
        const mediaDir = path.join(__dirname, 'media');
        
        if (!isPathSafe(filePath, mediaDir)) {
          throw new Error('Access denied: path traversal detected');
        }
        
        const fullPath = path.join(mediaDir, filePath);
        if (!existsSync(fullPath)) {
          throw new Error('File not found');
        }
      }
      
      return true;
    }),
  handleValidationErrors
];

app.post('/api/media/play', validateFileUrl, async (req, res) => {
  // ...
});
```

---

### 5. 📁 БЕЗОПАСНАЯ ЗАГРУЗКА ФАЙЛОВ

**Улучшенная конфигурация Multer:**
```javascript
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';

// Создание безопасного имени файла
function generateSafeFilename(originalname) {
  const ext = path.extname(originalname);
  const randomName = crypto.randomBytes(16).toString('hex');
  return randomName + ext;
}

// Валидация MIME типов
const allowedMimeTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/wav',
  'audio/aac',
  'audio/m4a',
  'audio/ogg',
  'audio/x-m4a',
  'audio/x-flac'
];

const upload = multer({
  dest: 'media/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Проверка MIME типа
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
    
    // Проверка расширения файла
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Invalid file extension.'));
    }
    
    cb(null, true);
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'media');
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Использование безопасного имени
      const safeName = generateSafeFilename(file.originalname);
      cb(null, safeName);
    }
  })
});

app.post('/api/media/upload', 
  strictLimiter, // Rate limiting
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Дополнительная проверка размера
      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large' });
      }
      
      // Сохранение метаданных
      storage.addMediaFile({
        name: req.file.originalname,
        filename: req.file.filename,
        path: '/media/' + req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      
      res.json({ success: true, file: req.file });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
```

---

### 6. 🔒 HTTPS НА СЕРВЕРЕ

**Установка:**
```bash
npm install https
```

**Реализация:**
```javascript
import https from 'https';
import fs from 'fs';
import path from 'path';

const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

if (HTTPS_ENABLED) {
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.cert'))
  };
  
  https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS server running on port ${HTTPS_PORT}`);
  });
  
  // Редирект с HTTP на HTTPS
  const http = require('http');
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
  }).listen(3000);
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server running on port ${PORT}`);
  });
}
```

**Генерация самоподписанного сертификата:**
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.cert -days 365 -nodes
```

---

### 7. 🚪 CORS КОНФИГУРАЦИЯ

**Текущая проблема:**
```javascript
// ОПАСНО: открыт для всех
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Безопасная конфигурация:**
```javascript
import cors from 'cors';

const corsOptions = {
  origin: function (origin, callback) {
    // Разрешенные источники
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    // Разрешить запросы без origin (например, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 часа
};

app.use(cors(corsOptions));
```

---

### 8. 🛡️ ЗАЩИТА ОТ XSS

**Санитизация данных:**
```javascript
import { sanitize } from 'sanitize-html';

// Функция для санитизации строк
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return sanitize(input, {
    allowedTags: [],
    allowedAttributes: {}
  });
}

// Middleware для санитизации входных данных
function sanitizeInput(req, res, next) {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }
  
  next();
}

app.use(express.json());
app.use(sanitizeInput);
```

**Заголовки безопасности:**
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
```

---

### 9. 📝 ЛОГИРОВАНИЕ И АУДИТ

**Установка:**
```bash
npm install winston
```

**Реализация:**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware для логирования запросов
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      ip: req.ip,
      status: res.statusCode,
      duration,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// Логирование критических действий
function logSecurityEvent(event, details) {
  logger.warn({
    type: 'security',
    event,
    details,
    timestamp: new Date().toISOString()
  });
}

// Использование
app.post('/api/players/scan', async (req, res) => {
  logSecurityEvent('network_scan', {
    ip: req.ip,
    subnet: req.body.subnet
  });
  // ...
});
```

---

### 10. 🔐 БЕЗОПАСНОЕ ХРАНЕНИЕ ПАРОЛЕЙ

**Использование bcrypt:**
```javascript
import bcrypt from 'bcrypt';

// Хеширование пароля
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Проверка пароля
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Сохранение пользователя
async function createUser(username, password) {
  const passwordHash = await hashPassword(password);
  // Сохранить в БД или файл
  return { username, passwordHash };
}
```

---

### 11. 🚨 ОБРАБОТКА ОШИБОК

**Безопасная обработка ошибок:**
```javascript
// Middleware для обработки ошибок
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Не раскрывать внутренние детали в продакшене
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred' 
    : err.message;
  
  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

---

### 12. 🔒 ОГРАНИЧЕНИЕ СКАНИРОВАНИЯ СЕТИ

**Безопасное сканирование:**
```javascript
// network-scanner.js
class NetworkScanner {
  constructor(subnet = '192.168.1') {
    // Валидация подсети
    if (!this.isValidSubnet(subnet)) {
      throw new Error('Invalid subnet format');
    }
    
    // Ограничение только локальными подсетями
    const allowedSubnets = ['192.168', '10.0', '172.16'];
    const isAllowed = allowedSubnets.some(allowed => subnet.startsWith(allowed));
    
    if (!isAllowed) {
      throw new Error('Only local network subnets are allowed');
    }
    
    this.subnet = subnet;
  }
  
  isValidSubnet(subnet) {
    const pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){2}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return pattern.test(subnet);
  }
  
  // Ограничение диапазона сканирования
  async scanSubnet(start = 1, end = 254) {
    // Максимум 50 IP за раз
    const maxRange = 50;
    if (end - start > maxRange) {
      end = start + maxRange;
    }
    
    // ...
  }
}
```

---

## 📋 ЧЕКЛИСТ ВНЕДРЕНИЯ

### Критичные (сделать немедленно):
- [ ] Добавить rate limiting
- [ ] Валидировать все входные данные
- [ ] Защитить от path traversal
- [ ] Улучшить обработку ошибок
- [ ] Ограничить сканирование сети

### Важные (в ближайшее время):
- [ ] Добавить аутентификацию (JWT или Basic)
- [ ] Настроить CORS правильно
- [ ] Добавить логирование
- [ ] Защитить загрузку файлов
- [ ] Добавить санитизацию данных

### Желательные (для продакшена):
- [ ] Включить HTTPS
- [ ] Добавить helmet для заголовков безопасности
- [ ] Настроить мониторинг безопасности
- [ ] Регулярные обновления зависимостей
- [ ] Аудит безопасности кода

---

## 🔧 КОНФИГУРАЦИЯ .env

```env
# Безопасность
AUTH_ENABLED=true
AUTH_METHOD=jwt
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# HTTPS
HTTPS_ENABLED=true
HTTPS_PORT=3443

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Логирование
LOG_LEVEL=info
NODE_ENV=production
```

---

## 📦 ЗАВИСИМОСТИ

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "winston": "^3.11.0",
    "sanitize-html": "^2.11.0"
  }
}
```

---

## 🎯 ПРИОРИТИЗАЦИЯ

1. **Неделя 1**: Rate limiting + Валидация + Path traversal защита
2. **Неделя 2**: Аутентификация (JWT) + Логирование
3. **Неделя 3**: CORS + Санитизация + Улучшенная загрузка файлов
4. **Неделя 4**: HTTPS + Helmet + Финальное тестирование

---

**Версия:** 1.0  
**Дата:** 2025-11-30  
**Статус:** Рекомендации для внедрения


