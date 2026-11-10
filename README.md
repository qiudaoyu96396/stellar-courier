# 星轨快递 · Stellar Courier

一款使用 HTML、CSS 和 Canvas 制作的太空街机小游戏。

[▶ 在线试玩](https://qiudaoyu96396.github.io/stellar-courier/stellar-courier-v2.html)

## 玩法

- 收集星核提升分数与连击倍率
- 躲避不断加速的陨石
- 使用冲刺撞碎陨石
- 拾取维修补给恢复船体
- 拾取护盾电池抵挡一次碰撞
- 每 20 秒进入更高航区，陨石速度与数量持续提升

## 操作

| 平台 | 操作 |
| --- | --- |
| 电脑 | `WASD` / 方向键移动，`空格` 冲刺 |
| 电脑 | `P` 暂停，`M` 静音 |
| 手机 | 拖动画面移动，点击右下角按钮冲刺 |

## 特性

- 单文件、零依赖、打开即玩
- Canvas 实时粒子、光效与屏幕震动
- Web Audio 动态音效
- 连击、护盾、维修、航区升级
- 本地保存最高分
- 桌面端与移动端响应式布局

## 本地运行

直接双击 `stellar-courier-v2.html`，或在目录中启动静态服务器：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/stellar-courier-v2.html`。

## 技术栈

- HTML5 Canvas
- CSS3
- 原生 JavaScript
- Web Audio API
- LocalStorage

## 许可证

本项目采用 [MIT License](LICENSE) 开源。
