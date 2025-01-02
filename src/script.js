// 读取 CSV 文件的工具函数
async function fetchCSV(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`无法加载文件：${filePath}，状态码：${response.status}`);
        }

        // 使用 TextDecoder 强制以 UTF-8 解码
        const arrayBuffer = await response.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(arrayBuffer);

        return parseCSV(text);
    } catch (error) {
        console.error(`加载文件时出错：${error.message}`);
        return [];
    }
}

// 解析 CSV 文本
function parseCSV(text) {
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line); // 去除空行

    if (lines.length === 0) return [];

    return lines.map(line => {
        const values = line.split(',').map(value => value.trim());
        if (values.length === 2) {
            // 两列的当作 namelist
            const [id, name] = values;
            return { id, name };
        } else if (values.length === 3) {
            // 三列的当作 winnerlist
            const [id, name, prize] = values;
            return { id, name, prize: prize || '' };
        } else {
            console.warn(`无法解析的行：${line}`);
            return null; // 如果列数不符合预期，返回 null
        }
    }).filter(entry => entry !== null); // 过滤掉无法解析的行
}

// 初始化全局变量
let namelist = [];
let winnerlist = [];
let availableNames = [];
let animationFrameId;
let isSpinning = false;
let scaleDirection = 1; // 控制球形放大和缩小的方向
let currentPrize = ''; // 当前奖项

// 初始化 Three.js 场景
const scene = new THREE.Scene();
const canvasContainer = document.getElementById('canvas-container');
const camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.clientWidth / canvasContainer.clientHeight, // 确保纵横比正确
    0.1,
    1000
);
camera.position.set(0, 0, 6); // 确保相机位于球体正前方
camera.lookAt(0, 0, 0); // 确保相机始终看向球体中心

// 添加坐标轴辅助工具,用于Debug
// const axesHelper = new THREE.AxesHelper(5); // 参数表示坐标轴的长度
// scene.add(axesHelper);

// 初始化渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // 设置 alpha: true 使背景透明
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio); // 确保高分辨率屏幕显示清晰
renderer.setClearColor(0x000000, 0); // 设置完全透明背景
canvasContainer.appendChild(renderer.domElement);

// 初始化 CSS2DRenderer
const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.width = '100%';
labelRenderer.domElement.style.height = '100%';
labelRenderer.domElement.style.pointerEvents = 'none'; // 禁止鼠标事件，避免影响 3D 场景交互
canvasContainer.appendChild(labelRenderer.domElement);

// 添加光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1); // 点光源
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// 创建 3D 球形
const sphereGroup = new THREE.Group();
sphereGroup.position.set(0, 0, 0); // 确保球体的中心在 (0, 0, 0)
scene.add(sphereGroup);

function createNameSphere(names) {
    // 清空 sphereGroup 中的所有子对象
    while (sphereGroup.children.length > 0) {
        sphereGroup.remove(sphereGroup.children[0]);
    }

    const maxDisplayCount = 100; // 球体上最多显示的用户数量
    const displayNames = names.slice(0, maxDisplayCount); // 只取前 maxDisplayCount 个用户

    const radius = 2.5; // 标签分布的球形半径

    displayNames.forEach((name, index) => {
        const phi = Math.acos(-1 + (2 * index) / displayNames.length); // 计算球面坐标
        const theta = Math.sqrt(displayNames.length * Math.PI) * phi;

        const x = radius * Math.sin(phi) * Math.cos(theta); // 修正 x 坐标公式
        const y = radius * Math.sin(phi) * Math.sin(theta); // 修正 y 坐标公式
        const z = radius * Math.cos(phi); // z 坐标公式保持不变

        // 创建名字标签
        const div = document.createElement('div');
        div.className = 'name-label';
        div.textContent = name;
        const label = new THREE.CSS2DObject(div);
        label.position.set(x, y, z); // 确保标签位置分布在球面上
        sphereGroup.add(label);
    });
}

// 动画函数
function animate() {
    if (isSpinning) {
        sphereGroup.rotation.y += 0.02; // 绕 Y 轴旋转
        sphereGroup.rotation.x += 0.01; // 绕 X 轴旋转

        // 添加整体球形的放大和缩小效果
        const scale = sphereGroup.scale.x + scaleDirection * 0.005;
        if (scale > 1.2 || scale < 0.8) {
            scaleDirection *= -1; // 反转缩放方向
        }
        sphereGroup.scale.set(scale, scale, scale);
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera); // 渲染标签
    animationFrameId = requestAnimationFrame(animate);
}

// 开始抽奖
document.getElementById('start-btn').addEventListener('click', () => {
    if (availableNames.length === 0) {
        alert('没有可用的名字！');
        return;
    }
    isSpinning = true;
    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    document.getElementById('winner-display').classList.add('hidden');
    animate();
});

// 停止抽奖
document.getElementById('stop-btn').addEventListener('click', () => {
    isSpinning = false;
    cancelAnimationFrame(animationFrameId);

    const winnerIndex = Math.floor(Math.random() * availableNames.length);
    const winner = availableNames.splice(winnerIndex, 1)[0];
    winnerlist.push({ ...winner, prize: currentPrize });

    // 高亮显示中奖者
    highlightWinner(winner);

    document.getElementById('winner-name').textContent = `${winner.name}（工号：${winner.id}）`;
    document.getElementById('winner-display').classList.remove('hidden');

    document.getElementById('start-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;

    // 实时更新 winnerlist.csv
    updateWinnerListOnServer();
});

// 实时更新 winnerlist.csv
function updateWinnerListOnServer() {
    fetch('/api/winnerlist', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(winnerlist),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to update winner list on server.');
            }
            return response.json();
        })
        .then((data) => {
            console.log(data.message);
        })
        .catch((error) => {
            console.error('Error updating winner list:', error);
        });
}

// 高亮显示中奖者
function highlightWinner(winner) {
    // 查找球体上是否已经显示了该用户
    let winnerLabel = sphereGroup.children.find(
        (child) => child.isCSS2DObject && child.element.textContent === winner.name
    );

    // 如果球体上没有显示该用户，则动态添加
    if (!winnerLabel) {
        const radius = 2.5; // 球体半径
        const phi = Math.random() * Math.PI; // 随机球面坐标
        const theta = Math.random() * 2 * Math.PI;

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        const div = document.createElement('div');
        div.className = 'name-label';
        div.textContent = winner.name;
        winnerLabel = new THREE.CSS2DObject(div);
        winnerLabel.position.set(x, y, z);
        sphereGroup.add(winnerLabel);

        // 立即刷新渲染器，确保动态添加的标签立刻显示
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }

    // 高亮名字标签
    winnerLabel.element.style.background = 'yellow';
    winnerLabel.element.style.color = 'black';
    winnerLabel.element.style.fontSize = '18px';
    winnerLabel.element.style.fontWeight = 'bold';
}

// 绑定齿轮按钮的点击事件，显示或隐藏配置面板
document.getElementById('config-btn').addEventListener('click', () => {
    const configMenu = document.getElementById('config-menu');
    if (configMenu.classList.contains('hidden')) {
        configMenu.classList.remove('hidden'); // 显示配置面板
    } else {
        configMenu.classList.add('hidden'); // 隐藏配置面板
    }
});

// 上传 namelist.csv
document.getElementById('upload-namelist').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('namelist', file);

    // 将文件发送到后端
    fetch('/api/upload-namelist', {
        method: 'POST',
        body: formData,
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('上传用户名单失败');
            }
            return response.json();
        })
        .then((data) => {
            console.log(data.message);
            alert('用户名单上传成功！');
            // 重新加载 namelist 数据
            init();
        })
        .catch((error) => {
            console.error('Error uploading namelist:', error);
            alert('上传用户名单失败，请重试！');
        });
});

// 下载中奖名单
document.getElementById('download-winnerlist').addEventListener('click', () => {
    fetch('/api/download-winnerlist')
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to download winner list.');
            }
            return response.blob();
        })
        .then((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'winnerlist.csv';
            link.click();
            URL.revokeObjectURL(url);
        })
        .catch((error) => {
            console.error('Error downloading winner list:', error);
        });
});

// 下载用户名单模板
document.getElementById('download-namelist-template').addEventListener('click', () => {
    const templateContent = '工号,姓名\n1001,张三\n1002,李四\n';
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'namelist-template.csv';
    link.click();

    URL.revokeObjectURL(url);
});

// 上传背景图
document.getElementById('upload-background').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.body.style.backgroundImage = `url(${e.target.result})`;
    };
    reader.readAsDataURL(file);
});

// 设置背景图 URL
document.getElementById('set-background-url').addEventListener('click', () => {
    const url = document.getElementById('background-url').value.trim();
    if (!url) {
        alert('请输入有效的背景图 URL！');
        return;
    }

    document.body.style.backgroundImage = `url(${url})`;
});

// 重置抽奖
document.getElementById('reset-btn').addEventListener('click', () => {
    availableNames = namelist.filter(user => !winnerlist.some(winner => winner.id === user.id));
    createNameSphere(availableNames.map(user => user.name));
    document.getElementById('winner-display').classList.add('hidden');

    // 清空后端的 winnerlist.csv 文件
    resetWinnerListOnServer();
    // 重新初始化
    init();
});

// 清空后端的 winnerlist.csv 文件
function resetWinnerListOnServer() {
    fetch('/api/reset-winnerlist', {
        method: 'POST',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to reset winner list on server.');
            }
            return response.json();
        })
        .then((data) => {
            console.log(data.message);
        })
        .catch((error) => {
            console.error('Error resetting winner list:', error);
        });
}

// 初始化数据
async function init() {
    namelist = await fetchCSV('../data/namelist.csv');
    winnerlist = await fetchCSV('../data/winnerlist.csv');

    initPrize();

    availableNames = namelist.filter(user => !winnerlist.some(winner => winner.id === user.id));

    if (availableNames.length === 0) {
        console.error('没有可用的名字！请检查 namelist.csv 和 winnerlist.csv 文件。');
    }

    createNameSphere(availableNames.map(user => user.name));
}

// 监听窗口大小变化，更新渲染器和相机
window.addEventListener('resize', () => {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
});

// 初始化奖项名称
function initPrize() {
    const prizeInput = document.getElementById('current-prize');
    currentPrize = prizeInput.value.trim(); // 获取输入框中的默认奖项名称

    // 监听奖项输入框的变化，实时更新奖项名称
    prizeInput.addEventListener('input', (event) => {
        currentPrize = event.target.value.trim();
        console.log(`当前奖项已更新为：${currentPrize}`);
    });
}

init();