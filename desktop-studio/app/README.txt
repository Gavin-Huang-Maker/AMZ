桌面净境 Desktop Studio v2.0

运行：完整解压压缩包，双击 DesktopStudio.exe。Windows 10/11，.NET Framework 4.x，无需管理员权限。
配置、用户导入壁纸及整理日志：%LOCALAPPDATA%\AMZDesktopStudio
归档文件：系统“文档”目录下的 AMZ桌面文件库（具体位置以界面显示为准）。

壁纸：选择 → 应用选中壁纸。自动轮播范围 1–1440 分钟。
纯壁纸模式：隐藏图标，不移动文件。托盘右键“显示桌面图标”即可恢复；也可桌面右键 → 查看 → 显示桌面图标。
原桌面恢复：恢复首次启动时的壁纸设置、图标状态，同时关闭轮播与自动整理。Windows 原生动态主题不在恢复范围。
整理：刷新预览 → 勾选文件 → 整理勾选文件。程序还会确认本批数量与路径。
自动整理：默认关闭；开启后每 10 分钟整理全部支持类型的稳定文件，不受预览勾选限制。
撤销：先自动停用自动整理，再恢复最近尚未恢复的一批。同名冲突不覆盖，解决后可重试。
退出：关闭按钮会收起到托盘。需完全退出时使用“退出程序”或托盘“退出”。

边界：只整理当前用户桌面顶层的已知资料类型；文件夹、软件、快捷方式、未知类型、隐藏与系统文件不移动。最近 5 分钟修改、正在占用的文件跳过。不整理公共桌面。文件移动后，依赖原路径的软件或链接可能要更新。云同步桌面移动会被同步服务反映到其他设备。
程序是自制未签名可执行文件，系统可能提示安全审核。无需关闭防病毒或改变系统安全设置。
卸载：先关闭自动整理、登录启动，按需撤销整理并恢复原桌面，退出程序后移除程序目录。归档文件请自行保留，配置目录不会自动删除。

图片与来源
01-Alpine-GT.png：内置 image_gen 生成，实际 1672×941；不是原生 4K。
提示词：Photorealistic landscape desktop wallpaper, unbranded graphite sports coupe on an alpine road, snow mountains, glacial lake, early morning light, no text or watermark. Requested 3840×2160; actual output dimensions must be used.
02-Alpine-Lake.png：内置 image_gen 生成，实际尺寸见程序。
提示词：Photorealistic snow mountain above still turquoise alpine lake, mist, pine trees, cool blue and pink dawn, no people, cars or text; 16:9 wallpaper.
03-Swiss-Winter.jpg：Pascal Debrunner / Unsplash。
https://unsplash.com/photos/a-snow-covered-mountain-with-a-lake-in-the-foreground-csQ3Bad5b8M
04-Porsche-Road.jpg：Carl Gelin / Unsplash。
https://unsplash.com/photos/a-car-driving-on-a-road-near-a-mountain-ui2jQgWzr3s
摄影图片依照 https://unsplash.com/license 使用。各图片真实尺寸见壁纸预览。程序不联网下载，不保证自动获取新图片。

源码：DesktopStudio.cs + DesktopPanels.cs
构建：运行同目录 build.ps1，使用 Windows 自带 .NET Framework C# 编译器。
测试：DesktopStudio.exe --self-test "完整路径\test-results.txt"。测试使用独立临时文件，不触碰真实桌面。

V2 桌面分区
- 在“桌面分区”页开启。默认三个分区：常用软件、常用文件、工作文件夹。
- 双击入口打开；拖标题移动；拖右下角缩放；点击 − 折叠。
- 拖入文件或快捷方式、点击 + 选择文件；右键空白处可添加文件夹。
- 右键项目可以改名、移到其他分区、移除入口。只移除入口，不删除或移动原文件。
- 关闭主窗口仍在托盘运行；正常退出程序后关闭分区并恢复启用前图标状态。
- 默认不自动导入用户私人文件，下载版由用户自行添加入口。
- 固定到分区的文件不会被归档功能移动。
- 分区配置：%LOCALAPPDATA%\AMZDesktopStudio\panels.json。
- 分区挂载到 Windows Explorer 桌面层，普通应用窗口可以覆盖它们。Explorer 重启时程序尝试重新挂载。
- 无法拖入时请使用 + 添加，建议以普通用户权限运行。
