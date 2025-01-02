const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');

const app = express();
const PORT = 3000;

// 全局变量
let namelist = [];
let winnerlist = [];

// 中间件：限制请求来源为本机
function restrictToLocalhost(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    next(); // 允许请求
  } else {
    res.status(403).json({ error: 'Forbidden: Requests are only allowed from localhost.' });
  }
}

// 获取运行时的文件路径
const getFilePath = (relativePath) => {
  if (process.pkg) {
    // 如果是打包后的环境，将文件存储在当前工作目录下
    return path.join(process.cwd(), relativePath);
  } else {
    // 如果是开发环境，使用项目目录下的路径
    return path.join(__dirname, relativePath);
  }
};

// 确保 data 目录存在
const ensureDataDirectory = () => {
  const dataDir = getFilePath('data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Data directory created:', dataDir);
  }
};

// 加载 namelist.csv 和 winnerlist.csv 到内存
function loadCSVToMemory(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return [];
  }
  return content.split('\n').map(line => {
    const [id, name, prize] = line.split(',');
    return { id, name, prize };
  });
}

// 初始化全局变量
function initializeData() {
  const namelistPath = getFilePath('data/namelist.csv');
  const winnerlistPath = getFilePath('data/winnerlist.csv');

  namelist = loadCSVToMemory(namelistPath);
  winnerlist = loadCSVToMemory(winnerlistPath);

  console.log('Namelist and Winnerlist initialized.');
}

// 设置静态文件目录为 src 和 dist
app.use(express.static(path.join(__dirname, 'src')));
app.use("/data", express.static(path.join(__dirname, 'dist')));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}));

// 设置静态文件目录为 data
app.use('/data', express.static(getFilePath('data')));

// 解析 JSON 请求体
app.use(bodyParser.json());

// 默认路由，返回打包后的 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 上传 namelist.csv 的 API
app.post('/api/upload-namelist', (req, res) => {
  if (!req.files || !req.files.namelist) {
    return res.status(400).json({ message: '未上传文件' });
  }

  const namelistFile = req.files.namelist;
  const uploadPath = getFilePath('data/namelist.csv');

  // 保存文件到服务器
  namelistFile.mv(uploadPath, (err) => {
    if (err) {
      console.error('保存文件失败:', err);
      return res.status(500).json({ message: '保存文件失败' });
    }

    // 重新加载 namelist 到内存
    namelist = loadCSVToMemory(uploadPath);

    console.log('用户名单已成功上传并保存到:', uploadPath);
    res.json({ message: '用户名单上传成功' });
  });
});

// 写入 winnerlist.csv 的 API（仅限本机请求）
app.post('/api/winnerlist', restrictToLocalhost, (req, res) => {
  const filePath = getFilePath('data/winnerlist.csv');
  const newWinners = req.body;

  if (!Array.isArray(newWinners)) {
    return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
  }

  // 将新数据转换为 CSV 格式
  const csvContent = newWinners.map(winner => `${winner.id},${winner.name},${winner.prize}`).join('\n') + '\n';

  // 追加写入文件
  fs.appendFile(filePath, csvContent, 'utf8', (err) => {
    if (err) {
      console.error('Error appending to winnerlist.csv:', err);
      return res.status(500).json({ error: 'Failed to append to file.' });
    }

    // 更新内存中的 winnerlist
    winnerlist.push(...newWinners);

    res.status(200).json({ message: 'Winner list updated successfully.' });
  });
});

// 清空 winnerlist.csv 的 API（仅限本机请求）
app.post('/api/reset-winnerlist', restrictToLocalhost, (req, res) => {
  const filePath = getFilePath('data/winnerlist.csv');

  // 写入空内容以清空文件
  fs.writeFile(filePath, '', 'utf8', (err) => {
    if (err) {
      console.error('Error resetting winnerlist.csv:', err);
      return res.status(500).json({ error: 'Failed to reset winner list.' });
    }

    // 清空内存中的 winnerlist
    winnerlist = [];

    res.status(200).json({ message: 'Winner list reset successfully.' });
  });
});

// 下载 winnerlist.csv 的 API（仅限本机请求）
app.get('/api/download-winnerlist', restrictToLocalhost, (req, res) => {
  const filePath = getFilePath('data/winnerlist.csv');

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Winner list file not found.' });
  }

  // 设置响应头，返回文件内容
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=winnerlist.csv');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// 启动服务器
app.listen(PORT, () => {
  ensureDataDirectory(); // 确保 data 目录存在
  initializeData(); // 初始化数据
  console.log(`Server is running at http://localhost:${PORT}`);
});