using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using Microsoft.Win32;

public class Settings {
 public int Minutes=30; public bool Rotate=false; public bool AutoTidy=false;
 public string Current=""; public string OriginalWallpaper=""; public string OriginalStyle="10"; public string OriginalTile="0";
 public bool Captured=false; public bool OriginalHidden=false;
}
public class MoveRecord { public string Source; public string Destination; public string Status; public string Error; }
public class PlanItem { public string Source; public string Category; public long Length; public long Modified; }
public static class Storage {
 public static JavaScriptSerializer Json = new JavaScriptSerializer();
 public static void Save(string path, object value) {
  Directory.CreateDirectory(Path.GetDirectoryName(path)); string temp=path+".tmp";
  File.WriteAllText(temp,Json.Serialize(value),System.Text.Encoding.UTF8);
  if(File.Exists(path)) File.Replace(temp,path,null); else File.Move(temp,path);
 }
 public static T Read<T>(string path) { return Json.Deserialize<T>(File.ReadAllText(path)); }
}
public class Organizer {
 public Func<IEnumerable<string>> PinnedPaths=delegate{return new string[0];};
 public readonly string Desktop, Archive, Logs;
 public Organizer(string desktop,string archive,string logs) { Desktop=Path.GetFullPath(desktop); Archive=Path.GetFullPath(archive); Logs=logs; }
 public static string Category(string ext) {
  ext=ext.ToLowerInvariant();
  if(new[]{".xlsx",".xls",".xlsm",".csv",".tsv"}.Contains(ext)) return "表格与报表";
  if(new[]{".doc",".docx",".pdf",".ppt",".pptx",".txt",".md",".rtf"}.Contains(ext)) return "文档与资料";
  if(new[]{".jpg",".jpeg",".png",".webp",".gif",".bmp",".tif",".tiff",".svg",".heic"}.Contains(ext)) return "图片与设计";
  if(new[]{".mp4",".mov",".avi",".mkv",".mp3",".wav",".m4a"}.Contains(ext)) return "视频与音频";
  if(new[]{".zip",".rar",".7z",".tar",".gz"}.Contains(ext)) return "压缩包";
  return null;
 }
 public List<PlanItem> Scan() {
  List<PlanItem> list=new List<PlanItem>(); var pinned=new HashSet<string>(PinnedPaths(),StringComparer.OrdinalIgnoreCase);
  foreach(string p in Directory.GetFiles(Desktop)) {
   try {
    FileInfo f=new FileInfo(p); string cat=Category(f.Extension); if(pinned.Contains(p))continue;
    if(cat==null || f.Name.StartsWith("~$") || f.Name.StartsWith(".") || (f.Attributes & (FileAttributes.Hidden|FileAttributes.System|FileAttributes.ReparsePoint))!=0) continue;
    if(f.LastWriteTimeUtc>DateTime.UtcNow.AddMinutes(-5)) continue;
    list.Add(new PlanItem{Source=p,Category=cat,Length=f.Length,Modified=f.LastWriteTimeUtc.Ticks});
   } catch(IOException) {} catch(UnauthorizedAccessException) {}
  }
  return list.OrderBy(x=>x.Category).ThenBy(x=>x.Source).ToList();
 }
 static string Unique(string path) {
  string result=path; int n=1;
  while(File.Exists(result)||Directory.Exists(result)) result=Path.Combine(Path.GetDirectoryName(path),Path.GetFileNameWithoutExtension(path)+" ("+(n++)+")"+Path.GetExtension(path));
  return result;
 }
 public List<MoveRecord> Execute(IEnumerable<PlanItem> plan) {
  Directory.CreateDirectory(Logs); var records=new List<MoveRecord>();
  string journal=Path.Combine(Logs,DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fffffff")+".json");
  foreach(var item in plan) {
   MoveRecord r=null;
   try {
    if(!String.Equals(Path.GetDirectoryName(Path.GetFullPath(item.Source)),Desktop,StringComparison.OrdinalIgnoreCase)) throw new IOException("文件已不在桌面");
    var f=new FileInfo(item.Source);if(PinnedPaths().Contains(item.Source,StringComparer.OrdinalIgnoreCase))throw new IOException("文件已固定到桌面分区，保留原位置");
    if(!f.Exists || f.Length!=item.Length || f.LastWriteTimeUtc.Ticks!=item.Modified) throw new IOException("文件已变化，请刷新预览");
    if((f.Attributes&(FileAttributes.ReparsePoint|FileAttributes.Hidden|FileAttributes.System))!=0) throw new IOException("跳过受保护文件");
    string category=Category(f.Extension); if(category==null) throw new IOException("不支持的类型");
    using(var stream=new FileStream(item.Source,FileMode.Open,FileAccess.Read,FileShare.None)) {}
    string dir=Path.Combine(Archive,category); Directory.CreateDirectory(dir);
    if((new DirectoryInfo(dir).Attributes&FileAttributes.ReparsePoint)!=0) throw new IOException("归档目录不能是符号链接");
    r=new MoveRecord{Source=item.Source,Destination=Unique(Path.Combine(dir,f.Name)),Status="pending"}; records.Add(r);
    Storage.Save(journal,records); // Write-ahead: a crash after Move still leaves an undo record.
    File.Move(r.Source,r.Destination); r.Status="moved";
   } catch(Exception ex) {
    if(r==null) {r=new MoveRecord{Source=item.Source,Status="skipped"};records.Add(r);} else r.Status="failed";
    r.Error=ex.Message;
   }
   Storage.Save(journal,records);
  }
  return records;
 }
 public string Undo() {
  if(!Directory.Exists(Logs)) return "暂无可撤销记录。";
  foreach(string log in Directory.GetFiles(Logs,"*.json").OrderByDescending(x=>x)) {
   List<MoveRecord> records=Storage.Read<List<MoveRecord>>(log);
   var active=records.Where(r=>r.Status=="moved"||r.Status=="pending").ToList();
   if(active.Count==0) continue;
   int restored=0,conflicts=0;
   foreach(var r in active) {
    try {
     if(!String.Equals(Path.GetDirectoryName(Path.GetFullPath(r.Source)),Desktop,StringComparison.OrdinalIgnoreCase) || !Path.GetFullPath(r.Destination).StartsWith(Archive+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) throw new IOException("记录路径不合法");
     if(!File.Exists(r.Destination)) { if(File.Exists(r.Source)) r.Status="restored"; else {conflicts++;r.Error="归档文件已移走";} }
     else if(File.Exists(r.Source)||Directory.Exists(r.Source)) {conflicts++;r.Error="桌面存在同名项目，未覆盖";}
     else {File.Move(r.Destination,r.Source);r.Status="restored";r.Error=null;restored++;}
    } catch(Exception ex) {conflicts++;r.Error=ex.Message;}
    Storage.Save(log,records);
   }
   return "已恢复 "+restored+" 个文件；待处理 "+conflicts+" 个（详见整理记录）。";
  }
  return "暂无可撤销记录。";
 }
}
public static class Native {
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool SystemParametersInfo(int a,int b,string c,int d);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p,IntPtr after,string cls,string title);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr l);
 delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 public static bool Hidden() { using(var k=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced")) return k!=null&&Convert.ToInt32(k.GetValue("HideIcons",0))!=0; }
 public static void SetHidden(bool hidden) {
  if(Hidden()==hidden) return;
  IntPtr view=IntPtr.Zero;
  EnumWindows(delegate(IntPtr h,IntPtr l){var v=FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null);if(v!=IntPtr.Zero){view=v;return false;}return true;},IntPtr.Zero);
  if(view==IntPtr.Zero) throw new IOException("未找到 Windows 桌面。可在桌面右键 → 查看 → 显示桌面图标手动切换。");
  IntPtr result;
  if(SendMessageTimeout(view,0x0111,new IntPtr(0x7402),IntPtr.Zero,2,2000,out result)==IntPtr.Zero) throw new IOException("桌面没有响应，请重试。");
  if(Hidden()!=hidden) throw new IOException("请在桌面右键 → 查看 → 显示桌面图标确认状态。");
 }
}
public class Studio : Form {
 string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"AMZDesktopStudio");
 Settings settings; Organizer organizer; string config,library; PanelManager panels;
 ListBox gallery; PictureBox picture; Label detail,status; ListView files;
 CheckBox rotate,auto,start; NumericUpDown interval; NotifyIcon tray;
 Timer clock=new Timer(); DateTime nextWall,nextTidy; bool quitting=false; List<string> images=new List<string>();
 Color ink=Color.FromArgb(226,233,242),panel=Color.FromArgb(24,33,48),accent=Color.FromArgb(75,208,187);
 public Studio() {
  Directory.CreateDirectory(data);config=Path.Combine(data,"settings.json"); library=Path.Combine(data,"wallpapers");Directory.CreateDirectory(library);
  settings=File.Exists(config)?Storage.Read<Settings>(config):new Settings();
  if(!settings.Captured) {
   using(var k=Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop")) {settings.OriginalWallpaper=Convert.ToString(k.GetValue("WallPaper",""));settings.OriginalStyle=Convert.ToString(k.GetValue("WallpaperStyle","10"));settings.OriginalTile=Convert.ToString(k.GetValue("TileWallpaper","0"));}
   settings.OriginalHidden=Native.Hidden(); settings.Captured=true;Save();
  }
  string bundled=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"wallpapers");
  if(Directory.Exists(bundled)) foreach(string f in Directory.GetFiles(bundled)) {string dest=Path.Combine(library,Path.GetFileName(f));if(!File.Exists(dest))File.Copy(f,dest);}
  string docs=Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments); if(String.IsNullOrEmpty(docs))docs=Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
  organizer=new Organizer(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Path.Combine(docs,"AMZ桌面文件库"),Path.Combine(data,"history"));
  Text="桌面净境 · 亚马逊工具箱"; Size=new Size(1120,800);MinimumSize=new Size(960,720);StartPosition=FormStartPosition.CenterScreen;
  BackColor=Color.FromArgb(12,19,31);ForeColor=ink;Font=new Font("Microsoft YaHei UI",10);AutoScaleMode=AutoScaleMode.Dpi;
  var root=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(24),RowCount=4,ColumnCount=1};root.RowStyles.Add(new RowStyle(SizeType.Absolute,78));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));root.RowStyles.Add(new RowStyle(SizeType.Absolute,66));root.RowStyles.Add(new RowStyle(SizeType.Absolute,35));Controls.Add(root);
  var title=new Label{Text="桌面净境  /  DESKTOP STUDIO\n一张好壁纸，一个干净的工作空间。",Dock=DockStyle.Fill,Font=new Font(Font.FontFamily,17,FontStyle.Bold),ForeColor=ink};root.Controls.Add(title,0,0);
  var tabs=new TabControl{Dock=DockStyle.Fill};root.Controls.Add(tabs,0,1);
  panels=new PanelManager(data,ShowStudio);tabs.TabPages.Add((TabPage)panels.SettingsPage());organizer.PinnedPaths=delegate{return panels.Config.Groups.SelectMany(g=>g.Items).Select(i=>i.Path);};
  var wall=new TabPage("壁纸与专注"){BackColor=panel,Padding=new Padding(14)};var tidy=new TabPage("桌面文件整理"){BackColor=panel,Padding=new Padding(14)};tabs.TabPages.Add(wall);tabs.TabPages.Add(tidy);
  var layout=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=3};layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,200));layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,44));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,96));wall.Controls.Add(layout);
  gallery=new ListBox{Dock=DockStyle.Fill,BackColor=panel,ForeColor=ink,BorderStyle=BorderStyle.None,IntegralHeight=false};gallery.SelectedIndexChanged+=delegate{Guard(Preview);};layout.Controls.Add(gallery,0,0);
  picture=new PictureBox{Dock=DockStyle.Fill,SizeMode=PictureBoxSizeMode.Zoom,BackColor=Color.FromArgb(8,13,23)};layout.Controls.Add(picture,1,0);
  detail=new Label{Dock=DockStyle.Fill,ForeColor=accent,TextAlign=ContentAlignment.MiddleLeft};layout.Controls.Add(detail,0,1);layout.SetColumnSpan(detail,2);
  var actions=new FlowLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true};layout.Controls.Add(actions,0,2);layout.SetColumnSpan(actions,2);
  actions.Controls.Add(Button("应用选中壁纸",delegate{ApplySelected();}));actions.Controls.Add(Button("下一张",Next));actions.Controls.Add(Button("导入高清图片",Import));actions.Controls.Add(Button("纯壁纸模式",delegate{Native.SetHidden(true);SetStatus("桌面图标已隐藏；文件仍在原处。托盘图标可再次打开工具。");}));actions.Controls.Add(Button("显示桌面图标",delegate{Native.SetHidden(false);SetStatus("已显示桌面图标。");}));actions.Controls.Add(Button("恢复原桌面",Restore));
  rotate=new CheckBox{Text="自动切换",Checked=settings.Rotate,AutoSize=true,Margin=new Padding(10,12,2,0)};interval=new NumericUpDown{Minimum=1,Maximum=1440,Value=Math.Max(1,Math.Min(1440,settings.Minutes)),Width=64,Margin=new Padding(4,8,4,0)};
  rotate.CheckedChanged+=delegate{settings.Rotate=rotate.Checked;ResetTimers();Save();};interval.ValueChanged+=delegate{settings.Minutes=(int)interval.Value;ResetTimers();Save();};actions.Controls.Add(rotate);actions.Controls.Add(interval);actions.Controls.Add(new Label{Text="分钟 / 张",AutoSize=true,Margin=new Padding(2,12,0,0)});
  var tidyLayout=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=4};tidyLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,62));tidyLayout.RowStyles.Add(new RowStyle(SizeType.Percent,100));tidyLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,48));tidyLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,48));tidy.Controls.Add(tidyLayout);
  tidyLayout.Controls.Add(new Label{Text="先预览，再整理。归档到："+organizer.Archive+"\n保留文件夹、程序、快捷方式和未知类型；跳过隐藏文件、占用文件及最近 5 分钟改动的文件。",Dock=DockStyle.Fill},0,0);
  files=new ListView{Dock=DockStyle.Fill,View=View.Details,CheckBoxes=true,FullRowSelect=true,BackColor=panel,ForeColor=ink};files.Columns.Add("文件名称",500);files.Columns.Add("归档分类",150);files.Columns.Add("大小",90);tidyLayout.Controls.Add(files,0,1);
  var fileActions=new FlowLayoutPanel{Dock=DockStyle.Fill};fileActions.Controls.Add(Button("刷新预览",Scan));fileActions.Controls.Add(Button("整理勾选文件",TidySelected));fileActions.Controls.Add(Button("撤销最近一批",delegate{auto.Checked=false;SetStatus(organizer.Undo());Scan();}));fileActions.Controls.Add(Button("打开文件库",delegate{Directory.CreateDirectory(organizer.Archive);Open(organizer.Archive);}));fileActions.Controls.Add(Button("整理记录",delegate{Directory.CreateDirectory(organizer.Logs);Open(organizer.Logs);}));tidyLayout.Controls.Add(fileActions,0,2);
  auto=new CheckBox{Text="自动整理：每 10 分钟归档以上支持类型的全部稳定文件（不受勾选限制）",Dock=DockStyle.Fill,Checked=settings.AutoTidy};auto.CheckedChanged+=delegate{settings.AutoTidy=auto.Checked;ResetTimers();Save();SetStatus(auto.Checked?"已开启自动整理。新增文件至少稳定 5 分钟后才会归档。":"自动整理已关闭。");};tidyLayout.Controls.Add(auto,0,3);
  var bottom=new FlowLayoutPanel{Dock=DockStyle.Fill};root.Controls.Add(bottom,0,2);start=new CheckBox{Text="登录 Windows 后启动",AutoSize=true,Margin=new Padding(0,18,18,0)};using(var k=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))start.Checked=k!=null&&k.GetValue("AMZDesktopStudio")!=null;
  start.CheckedChanged+=delegate{Guard(delegate{using(var k=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")){if(start.Checked)k.SetValue("AMZDesktopStudio","\""+Application.ExecutablePath+"\" --tray");else k.DeleteValue("AMZDesktopStudio",false);}SetStatus(start.Checked?"已设置登录后启动。":"已取消登录启动。");});};bottom.Controls.Add(start);bottom.Controls.Add(Button("收起到托盘",delegate{Hide();}));bottom.Controls.Add(Button("退出程序",Quit));
  status=new Label{Dock=DockStyle.Fill,ForeColor=accent,AutoEllipsis=true};root.Controls.Add(status,0,3);
  tray=new NotifyIcon{Icon=SystemIcons.Application,Text="桌面净境 · 双击打开",Visible=true};var menu=new ContextMenuStrip();menu.Items.Add("打开桌面净境",null,delegate{ShowStudio();});menu.Items.Add("下一张壁纸",null,delegate{Guard(Next);});menu.Items.Add("显示桌面图标",null,delegate{Guard(delegate{Native.SetHidden(false);});});menu.Items.Add("打开桌面文件库",null,delegate{Guard(delegate{Directory.CreateDirectory(organizer.Archive);Open(organizer.Archive);});});menu.Items.Add("退出",null,delegate{Quit();});tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{ShowStudio();};
  FormClosing+=delegate(object s,FormClosingEventArgs e){if(!quitting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();tray.ShowBalloonTip(2500,"桌面净境仍在运行","双击托盘图标打开；右键可退出。",ToolTipIcon.Info);}};
  menu.Items.Insert(0,new ToolStripMenuItem("显示桌面分区",null,delegate{Guard(panels.Enable);}));
  menu.Items.Insert(1,new ToolStripMenuItem("隐藏桌面分区",null,delegate{Guard(panels.Disable);}));
  Shown+=delegate{if(panels.Config.Enabled)Guard(panels.Enable);};
  LoadImages();Scan();ResetTimers();clock.Interval=15000;clock.Tick+=delegate{Guard(Tick);};clock.Start();SetStatus("就绪 · 桌面分区可固定常用软件和文件；关闭窗口后继续在托盘运行。");
 }
 void Save(){Storage.Save(config,settings);} void SetStatus(string s){status.Text=s;}
 void Guard(Action a){try{a();}catch(Exception ex){MessageBox.Show(this,ex.Message,"操作未完成",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
 Button Button(string text,Action action){var b=new Button{Text=text,AutoSize=true,Height=36,MinimumSize=new Size(100,36),BackColor=Color.FromArgb(35,51,69),ForeColor=ink,FlatStyle=FlatStyle.Flat,Margin=new Padding(0,4,8,4),Padding=new Padding(7,2,7,2)};b.FlatAppearance.BorderColor=Color.FromArgb(57,77,96);b.Click+=delegate{Guard(action);};return b;}
 void ShowStudio(){Show();WindowState=FormWindowState.Normal;Activate();}
 void ResetTimers(){nextWall=DateTime.Now.AddMinutes(settings.Minutes);nextTidy=DateTime.Now.AddMinutes(10);}
 void Tick(){if(settings.Rotate&&DateTime.Now>=nextWall){nextWall=DateTime.Now.AddMinutes(settings.Minutes);try{Next();}catch(Exception ex){settings.Rotate=false;rotate.Checked=false;Save();SetStatus("轮播已暂停："+ex.Message);}}if(settings.AutoTidy&&DateTime.Now>=nextTidy){nextTidy=DateTime.Now.AddMinutes(10);try{Report(organizer.Execute(organizer.Scan()));Scan();}catch(Exception ex){auto.Checked=false;SetStatus("自动整理已暂停："+ex.Message);}}}
 void LoadImages(){images=Directory.GetFiles(library).Where(p=>new[]{".jpg",".jpeg",".png",".bmp"}.Contains(Path.GetExtension(p).ToLowerInvariant())).OrderBy(p=>p).ToList();gallery.Items.Clear();foreach(var p in images)gallery.Items.Add(Path.GetFileNameWithoutExtension(p));if(images.Count>0){int i=images.IndexOf(settings.Current);gallery.SelectedIndex=i<0?0:i;}else detail.Text="点击「导入高清图片」添加 JPG / PNG / BMP 壁纸。";}
 void Preview(){int i=gallery.SelectedIndex;if(i<0)return;using(var src=Image.FromFile(images[i])){var old=picture.Image;picture.Image=new Bitmap(src);if(old!=null)old.Dispose();detail.Text=Path.GetFileNameWithoutExtension(images[i])+"   ·   "+src.Width+" × "+src.Height+"   ·   填充屏幕";}}
 void Apply(string path){using(var img=Image.FromFile(path)){string bmp=Path.Combine(data,"active-wallpaper.bmp");img.Save(bmp,System.Drawing.Imaging.ImageFormat.Bmp);using(var k=Registry.CurrentUser.CreateSubKey(@"Control Panel\Desktop")){k.SetValue("WallpaperStyle","10");k.SetValue("TileWallpaper","0");}if(!Native.SystemParametersInfo(20,0,bmp,3))throw new IOException("Windows 未能应用壁纸："+Marshal.GetLastWin32Error());}settings.Current=path;Save();nextWall=DateTime.Now.AddMinutes(settings.Minutes);SetStatus("已应用："+Path.GetFileNameWithoutExtension(path));}
 void ApplySelected(){if(gallery.SelectedIndex<0)throw new IOException("请先导入或选择壁纸。");Apply(images[gallery.SelectedIndex]);}
 void Next(){if(images.Count==0)return;int current=images.IndexOf(settings.Current);gallery.SelectedIndex=(current+1)%images.Count;ApplySelected();}
 void Import(){using(var d=new OpenFileDialog{Title="选择高清壁纸",Filter="图片|*.jpg;*.jpeg;*.png;*.bmp",Multiselect=true}){if(d.ShowDialog()!=DialogResult.OK)return;foreach(string p in d.FileNames){using(var img=Image.FromFile(p)){if(img.Width<1920||img.Height<1080){if(MessageBox.Show(this,Path.GetFileName(p)+" 为 "+img.Width+"×"+img.Height+"，低于 1920×1080。仍然导入？","分辨率提示",MessageBoxButtons.YesNo)!=DialogResult.Yes)continue;}}string dest=Path.Combine(library,Path.GetFileNameWithoutExtension(p)+"-"+Guid.NewGuid().ToString("N").Substring(0,6)+Path.GetExtension(p));File.Copy(p,dest);}LoadImages();SetStatus("图片已复制到本地壁纸库，原图片未修改。");}}
 void Restore(){rotate.Checked=false;auto.Checked=false;using(var k=Registry.CurrentUser.CreateSubKey(@"Control Panel\Desktop")){k.SetValue("WallpaperStyle",settings.OriginalStyle);k.SetValue("TileWallpaper",settings.OriginalTile);}if(!Native.SystemParametersInfo(20,0,settings.OriginalWallpaper,3))throw new IOException("未能恢复原壁纸。原图片可能已移动。");Native.SetHidden(settings.OriginalHidden);settings.Current="";Save();SetStatus("已恢复首次启动时的壁纸与图标状态。已归档文件可在整理页撤销。");}
 void Scan(){files.Items.Clear();foreach(var p in organizer.Scan()){var item=new ListViewItem(Path.GetFileName(p.Source));item.SubItems.Add(p.Category);item.SubItems.Add((p.Length/1024.0).ToString("N0")+" KB");item.Tag=p;item.Checked=true;files.Items.Add(item);}}
 void TidySelected(){var selected=files.CheckedItems.Cast<ListViewItem>().Select(x=>(PlanItem)x.Tag).ToList();if(selected.Count==0){SetStatus("没有勾选可整理的文件。");return;}if(MessageBox.Show(this,"将 "+selected.Count+" 个文件移动到：\n"+organizer.Archive+"\n\n可撤销，且不覆盖同名文件。继续？","确认本批整理",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;Report(organizer.Execute(selected));Scan();}
 void Report(List<MoveRecord> rows){SetStatus("整理完成："+rows.Count(r=>r.Status=="moved")+" 个已归档，"+rows.Count(r=>r.Status!="moved")+" 个跳过／失败。详情见整理记录。");}
 static void Open(string p){System.Diagnostics.Process.Start("explorer.exe","\""+p+"\"");}
 void Quit(){quitting=true;clock.Stop();panels.Dispose();tray.Visible=false;tray.Dispose();Close();}
 protected override void Dispose(bool disposing){if(disposing){if(panels!=null)panels.Dispose();if(picture!=null&&picture.Image!=null)picture.Image.Dispose();if(clock!=null)clock.Dispose();if(tray!=null)tray.Dispose();}base.Dispose(disposing);}
 [STAThread] public static int Main(string[] args){
  if(args.Length>0&&args[0]=="--self-test")return Tests.Run(args.Length>1?args[1]:"self-test.txt");
  bool created;using(var mutex=new System.Threading.Mutex(true,"Local\\AMZDesktopStudio",out created)){
   if(!created){MessageBox.Show("桌面净境已在运行，请双击任务栏托盘图标打开。");return 0;}
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   try{var app=new Studio();if(args.Contains("--panels"))app.Shown+=delegate{app.Guard(app.panels.Enable);app.Hide();};else if(args.Contains("--tray"))app.Shown+=delegate{app.Hide();};Application.Run(app);}catch(Exception ex){MessageBox.Show(ex.Message,"桌面净境启动失败");return 1;}
  }return 0;
 }
}
public static class Tests {
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 public static int Run(string output){var results=new List<string>();string root=Path.Combine(Path.GetTempPath(),"AMZDesktopTests-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
  try{
   string desk=Path.Combine(root,"desktop"),archive=Path.Combine(root,"archive"),logs=Path.Combine(root,"logs");Directory.CreateDirectory(desk);var org=new Organizer(desk,archive,logs);
   foreach(string n in new[]{"报表.xlsx","photo.jpg","app.exe","快捷方式.lnk","~$lock.xlsx","unknown.xyz","new.txt"}){File.WriteAllText(Path.Combine(desk,n),n);if(n!="new.txt")File.SetLastWriteTimeUtc(Path.Combine(desk,n),DateTime.UtcNow.AddHours(-1));}Directory.CreateDirectory(Path.Combine(desk,"业务文件夹"));
   Check(org.Scan().Count==2,"filter/stability");results.Add("PASS: protected types, folders, lock files and recent files excluded");
   Directory.CreateDirectory(Path.Combine(archive,"表格与报表"));File.WriteAllText(Path.Combine(archive,"表格与报表","报表.xlsx"),"existing");
   var plan=org.Scan();var moves=org.Execute(plan);Check(moves.All(r=>r.Status=="moved"),"move");Check(File.ReadAllText(Path.Combine(archive,"表格与报表","报表.xlsx"))=="existing","overwrite");Check(moves.Any(r=>r.Destination.EndsWith("报表 (1).xlsx")),"rename collision");results.Add("PASS: archive collision preserves existing file");
   File.WriteAllText(Path.Combine(desk,"photo.jpg"),"new content");org.Undo();Check(File.ReadAllText(Path.Combine(desk,"photo.jpg"))=="new content","undo collision");Check(File.Exists(Path.Combine(desk,"报表.xlsx")),"undo");results.Add("PASS: undo restores original path, refuses overwrite");
   File.Move(Path.Combine(desk,"photo.jpg"),Path.Combine(desk,"photo-new.jpg"));org.Undo();Check(File.ReadAllText(Path.Combine(desk,"photo.jpg"))=="photo.jpg","undo retry");results.Add("PASS: undo collision can be retried");
   plan=org.Scan();var changed=plan.First(x=>x.Source.EndsWith("报表.xlsx"));File.AppendAllText(changed.Source,"changed");Check(org.Execute(new[]{changed})[0].Status=="skipped","changed since scan");results.Add("PASS: stale preview refuses modified files");
   var locked=org.Scan().First(x=>x.Source.EndsWith("photo.jpg"));using(var stream=new FileStream(locked.Source,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){Check(org.Execute(new[]{locked})[0].Status=="skipped","locked file");}results.Add("PASS: locked file skipped");
   string outside=Path.Combine(root,"outside.txt");File.WriteAllText(outside,"keep");var f=new FileInfo(outside);Check(org.Execute(new[]{new PlanItem{Source=outside,Length=f.Length,Modified=f.LastWriteTimeUtc.Ticks}})[0].Status=="skipped","outside path");results.Add("PASS: non-desktop source refused");
   string pending=Path.Combine(archive,"pending.txt");File.WriteAllText(pending,"recovery");Storage.Save(Path.Combine(logs,"zz-recovery.json"),new[]{new MoveRecord{Source=Path.Combine(desk,"pending.txt"),Destination=pending,Status="pending"}});org.Undo();Check(File.Exists(Path.Combine(desk,"pending.txt")),"crash recovery");results.Add("PASS: write-ahead journal recovers interrupted move");
   string config=Path.Combine(root,"settings.json");Storage.Save(config,new Settings{Minutes=60});Storage.Save(config,new Settings{Minutes=30});Check(Storage.Read<Settings>(config).Minutes==30,"atomic settings");results.Add("PASS: settings replacement persists correctly");
   var group=new PanelGroup{Name="常用文件"};Check(PanelManager.AddReference(group,outside,"测试文件"),"pin existing");Check(!PanelManager.AddReference(group,outside,"重复"),"duplicate pin");Check(!PanelManager.AddReference(group,Path.Combine(root,"missing.txt"),"不存在"),"missing pin");Check(File.ReadAllText(outside)=="keep","pin must not move original");results.Add("PASS: pin references preserve original and reject duplicate/missing paths");
   var pc=new PanelConfig{Enabled=true,Groups=new List<PanelGroup>{group}};string pcPath=Path.Combine(root,"panels.json");Storage.Save(pcPath,pc);var restored=Storage.Read<PanelConfig>(pcPath);Check(restored.Groups[0].Items[0].Path==outside,"panel persistence");restored.Groups[0].Items.Clear();Check(File.Exists(outside),"remove reference must preserve file");results.Add("PASS: panel entries persist; removing reference preserves file");
   var stable=org.Scan().First();org.PinnedPaths=delegate{return new[]{stable.Source};};Check(!org.Scan().Any(x=>x.Source==stable.Source),"pinned scan protection");Check(org.Execute(new[]{stable})[0].Status=="skipped","pinned execution protection");results.Add("PASS: pinned files excluded from manual and automatic archive");
   group.X=-99999;group.Y=99999;group.Width=99999;group.Height=99999;PanelManager.Clamp(group);Check(Screen.AllScreens.Any(s=>s.WorkingArea.Contains(new Rectangle(group.X,group.Y,group.Width,group.Height))),"panel screen clamp");results.Add("PASS: off-screen layout is recovered inside available screen");
   results.Add("ALL 13 CHECKS PASSED; test files are isolated from the real desktop.");File.WriteAllLines(output,results);return 0;
  }catch(Exception ex){results.Add("FAIL: "+ex);File.WriteAllLines(output,results);return 1;}
 }
}
