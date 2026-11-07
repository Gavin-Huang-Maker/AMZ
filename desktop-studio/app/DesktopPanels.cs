using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class PanelEntry { public string Name; public string Path; }
public class PanelGroup {
 public string Id=Guid.NewGuid().ToString("N"); public string Name="新分区";
 public int X=30,Y=30,Width=350,Height=230; public bool Folded=false;
 public List<PanelEntry> Items=new List<PanelEntry>();
}
public class PanelConfig { public bool Enabled=false; public bool IconsWereHidden=false; public List<PanelGroup> Groups=new List<PanelGroup>(); }
public static class DesktopHost {
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p,IntPtr after,string cls,string title);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetParent(IntPtr child,IntPtr parent);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int n);
 [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h,int n,int value);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr h,ref Point p);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
 public static IntPtr Find() {IntPtr found=IntPtr.Zero;EnumWindows(delegate(IntPtr h,IntPtr p){IntPtr view=FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null);if(view!=IntPtr.Zero){found=view;return false;}return true;},IntPtr.Zero);return found;}
 public static void Attach(Form form,IntPtr host,Rectangle rect) {
  if(host==IntPtr.Zero)throw new IOException("未找到 Windows 桌面，请在资源管理器恢复后重试。");
  var h=form.Handle;int old=GetWindowLong(h,-16);SetWindowLong(h,-16,(old|0x40000000)&unchecked((int)~0x80000000));SetParent(h,host);
  if(GetParent(h)!=host){SetWindowLong(h,-16,old);throw new IOException("Windows 未能挂载桌面分区。");}
  Place(form,host,rect);
 }
 public static void Place(Form form,IntPtr host,Rectangle rect){Point p=rect.Location;ScreenToClient(host,ref p);if(!SetWindowPos(form.Handle,IntPtr.Zero,p.X,p.Y,rect.Width,rect.Height,0x0010|0x0020|0x0040))throw new IOException("分区位置设置失败。");}
}
public class PanelManager : IDisposable {
 public PanelConfig Config; public readonly string ConfigPath; public readonly List<DesktopPanel> Windows=new List<DesktopPanel>();
 readonly Action openSettings; readonly Timer health=new Timer(); public IntPtr Host; bool disposed=false;
 public PanelManager(string data,Action open){ConfigPath=Path.Combine(data,"panels.json");openSettings=open;Config=File.Exists(ConfigPath)?Storage.Read<PanelConfig>(ConfigPath):new PanelConfig();if(Config.Groups.Count==0){foreach(string name in new[]{"常用软件","常用文件","工作文件夹"})Config.Groups.Add(new PanelGroup{Name=name});ResetLayout(false);}health.Interval=5000;health.Tick+=delegate{if(Config.Enabled&&!disposed){try{if(!DesktopHost.IsWindow(Host)||Windows.Any(w=>w.IsDisposed||!DesktopHost.IsWindow(w.Handle)))ShowPanels();WriteHealth();}catch(Exception ex){WriteError(ex);}}};health.Start();}
 public void Save(){Storage.Save(ConfigPath,Config);}
 public void WriteError(Exception ex){File.WriteAllText(Path.Combine(Path.GetDirectoryName(ConfigPath),"panels-error.txt"),DateTime.Now+" "+ex.Message);}
 public void WriteHealth(){Storage.Save(Path.Combine(Path.GetDirectoryName(ConfigPath),"panels-health.json"),new {At=DateTime.Now.ToString("s"),Enabled=Config.Enabled,Attached=DesktopHost.IsWindow(Host),Panels=Windows.Select(w=>new {Name=w.Group.Name,Items=w.Group.Items.Count,Visible=DesktopHost.IsWindowVisible(w.Handle),X=w.Group.X,Y=w.Group.Y,Width=w.Group.Width,Height=w.Group.Height}).ToArray()});}
 public void Enable(){if(!Config.Enabled)Config.IconsWereHidden=Native.Hidden();ShowPanels();Native.SetHidden(true);Config.Enabled=true;Save();WriteHealth();}
 public void Disable(){Config.Enabled=false;Save();ClosePanels();Native.SetHidden(Config.IconsWereHidden);}
 void ClosePanels(){foreach(var w in Windows.ToArray())if(!w.IsDisposed)w.Dispose();Windows.Clear();}
 public void ShowPanels(){ClosePanels();Host=DesktopHost.Find();if(Host==IntPtr.Zero)throw new IOException("桌面未就绪，请稍后点击“显示桌面分区”。");foreach(var g in Config.Groups){Clamp(g);var window=new DesktopPanel(this,g,openSettings);Windows.Add(window);window.Show();DesktopHost.Attach(window,Host,Bounds(g));}Save();WriteHealth();}
 public Rectangle Bounds(PanelGroup g){return new Rectangle(g.X,g.Y,g.Width,g.Folded?48:g.Height);}
 public static void Clamp(PanelGroup g){Rectangle area=Screen.AllScreens.Select(s=>s.WorkingArea).FirstOrDefault(a=>a.Contains(new Point(g.X,g.Y)));if(area.IsEmpty)area=Screen.PrimaryScreen.WorkingArea;g.Width=Math.Min(area.Width,Math.Max(280,g.Width));g.Height=Math.Min(area.Height,Math.Max(160,g.Height));g.X=Math.Max(area.Left,Math.Min(g.X,area.Right-g.Width));g.Y=Math.Max(area.Top,Math.Min(g.Y,area.Bottom-(g.Folded?48:g.Height)));}
 public void Place(DesktopPanel panel){Clamp(panel.Group);DesktopHost.Place(panel,Host,Bounds(panel.Group));}
 public void ResetLayout(bool refresh){Rectangle area=Screen.PrimaryScreen.WorkingArea;int w=Math.Min(350,area.Width-40);int h=Math.Max(160,Math.Min(280,(area.Height-64)/3));for(int i=0;i<Config.Groups.Count;i++){var g=Config.Groups[i];g.Width=w;g.Height=h;g.X=area.Right-24-w-(i/3)*(w+16);g.Y=area.Top+20+(i%3)*(h+12);g.Folded=false;Clamp(g);}Save();if(refresh&&Config.Enabled)ShowPanels();}
 public static bool AddReference(PanelGroup group,string path,string name){if(!File.Exists(path)&&!Directory.Exists(path))return false;path=Path.GetFullPath(path);if(group.Items.Any(x=>String.Equals(x.Path,path,StringComparison.OrdinalIgnoreCase)))return false;group.Items.Add(new PanelEntry{Name=String.IsNullOrWhiteSpace(name)?System.IO.Path.GetFileNameWithoutExtension(path):name,Path=path});return true;}
 public void AddPaths(PanelGroup group,IEnumerable<string> paths){int added=0;foreach(var p in paths){if(AddReference(group,p,null))added++;}Save();Refresh(group);}
 public void Refresh(PanelGroup group){foreach(var w in Windows.Where(w=>w.Group==group))w.RenderItems();Save();}
 public static string Ask(string title,string initial){using(var dialog=new Form{Text=title,Width=390,Height=160,FormBorderStyle=FormBorderStyle.FixedDialog,StartPosition=FormStartPosition.CenterScreen,MinimizeBox=false,MaximizeBox=false}){var input=new TextBox{Text=initial,Left=18,Top=20,Width=335};var ok=new Button{Text="确定",Left=260,Top=62,Width=90,DialogResult=DialogResult.OK};dialog.Controls.Add(input);dialog.Controls.Add(ok);dialog.AcceptButton=ok;return dialog.ShowDialog()==DialogResult.OK?input.Text.Trim():null;}}
 public void AddGroup(){string name=Ask("新建桌面分区","新分区");if(String.IsNullOrWhiteSpace(name))return;Config.Groups.Add(new PanelGroup{Name=name});ResetLayout(true);}
 public Control SettingsPage(){var page=new TabPage("桌面分区"){BackColor=Color.FromArgb(24,33,48),Padding=new Padding(24)};var flow=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true};page.Controls.Add(flow);flow.Controls.Add(new Label{Text="桌面上的三个小框，常用项目随手打开。",AutoSize=true,Font=new Font("Microsoft YaHei UI",16,FontStyle.Bold),Margin=new Padding(0,0,0,16)});flow.Controls.Add(new Label{Text="双击打开 · 拖标题移动 · 拖右下角缩放 · 点击 − 折叠\n将文件或快捷方式拖进框内即可固定，原文件不移动。\n右键项目可重命名、移到别的分区或移除入口；不会删除原文件。",AutoSize=true,Margin=new Padding(0,0,0,20)});
  Action<string,Action> add=delegate(string title,Action action){var b=new Button{Text=title,Width=300,Height=42,BackColor=Color.FromArgb(35,51,69),ForeColor=Color.White,FlatStyle=FlatStyle.Flat};b.Click+=delegate{try{action();}catch(Exception ex){MessageBox.Show(ex.Message,"桌面分区");}};flow.Controls.Add(b);};
  add("显示桌面分区 · 隐藏散乱图标",Enable);add("隐藏分区 · 恢复原图标状态",Disable);add("新建一个分区",AddGroup);add("重置分区位置到屏幕右侧",delegate{ResetLayout(true);});flow.Controls.Add(new Label{Text="桌面分区不会修改壁纸。分区布局和固定项目自动保存在本机。\n主窗口关闭后分区仍运行；退出程序时分区关闭并恢复原图标状态。",AutoSize=true,Margin=new Padding(0,20,0,0)});return page;
 }
 public void Dispose(){if(disposed)return;disposed=true;health.Dispose();ClosePanels();if(Config.Enabled){try{Native.SetHidden(Config.IconsWereHidden);}catch{}}}
}
public class DesktopPanel : Form {
 public readonly PanelGroup Group; readonly PanelManager manager; readonly Action openSettings;
 FlowLayoutPanel items; Label title; Panel header; bool dragging,resizing;Point startMouse,startLocation;Size startSize;ToolTip tips=new ToolTip();
 Color baseColor=Color.FromArgb(26,34,49),fg=Color.FromArgb(235,241,248),accent=Color.FromArgb(126,222,206);
 protected override bool ShowWithoutActivation{get{return true;}}
 protected override CreateParams CreateParams{get{var cp=base.CreateParams;cp.ExStyle|=0x80;return cp;}}
 public DesktopPanel(PanelManager mgr,PanelGroup group,Action settings){manager=mgr;Group=group;openSettings=settings;Text="桌面分区 · "+group.Name;FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;Bounds=manager.Bounds(group);BackColor=baseColor;ForeColor=fg;Font=new Font("Microsoft YaHei UI",9);Padding=new Padding(1);AllowDrop=true;
  header=new Panel{Dock=DockStyle.Top,Height=46,BackColor=Color.FromArgb(37,49,67)};title=new Label{Text=group.Name,AutoEllipsis=true,Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,Padding=new Padding(14,0,0,0),Font=new Font(Font.FontFamily,11,FontStyle.Bold),Cursor=Cursors.SizeAll};header.Controls.Add(title);
  var add=new Button{Text="+",Dock=DockStyle.Right,Width=36,FlatStyle=FlatStyle.Flat,ForeColor=accent};var fold=new Button{Text=group.Folded?"+":"−",Dock=DockStyle.Right,Width=36,FlatStyle=FlatStyle.Flat,ForeColor=fg};add.FlatAppearance.BorderSize=0;fold.FlatAppearance.BorderSize=0;header.Controls.Add(add);header.Controls.Add(fold);add.Click+=delegate{AddFiles();};fold.Click+=delegate{Group.Folded=!Group.Folded;fold.Text=Group.Folded?"+":"−";items.Visible=!Group.Folded;manager.Place(this);manager.Save();};
  var footer=new Label{Dock=DockStyle.Bottom,Height=23,Text="拖入即可固定   ·   双击打开      ◢",ForeColor=Color.FromArgb(156,174,194),TextAlign=ContentAlignment.MiddleRight,Cursor=Cursors.SizeNWSE,Font=new Font(Font.FontFamily,8)};
  items=new FlowLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true,Padding=new Padding(8,5,3,3),AllowDrop=true,Visible=!group.Folded};Controls.Add(items);Controls.Add(footer);Controls.Add(header);
  title.MouseDown+=delegate(object s,MouseEventArgs e){if(e.Button==MouseButtons.Left){dragging=true;startMouse=Cursor.Position;startLocation=new Point(Group.X,Group.Y);title.Capture=true;}};title.MouseMove+=delegate{if(dragging){Point now=Cursor.Position;Group.X=startLocation.X+now.X-startMouse.X;Group.Y=startLocation.Y+now.Y-startMouse.Y;manager.Place(this);}};title.MouseUp+=delegate{dragging=false;title.Capture=false;manager.Save();};
  footer.MouseDown+=delegate(object s,MouseEventArgs e){if(e.Button==MouseButtons.Left){resizing=true;startMouse=Cursor.Position;startSize=new Size(Group.Width,Group.Height);footer.Capture=true;}};footer.MouseMove+=delegate{if(resizing){Group.Width=startSize.Width+Cursor.Position.X-startMouse.X;Group.Height=startSize.Height+Cursor.Position.Y-startMouse.Y;manager.Place(this);}};footer.MouseUp+=delegate{resizing=false;footer.Capture=false;manager.Save();};
  DragEventHandler enter=delegate(object s,DragEventArgs e){e.Effect=e.Data.GetDataPresent(DataFormats.FileDrop)?DragDropEffects.Link:DragDropEffects.None;};DragEventHandler drop=delegate(object s,DragEventArgs e){try{var paths=e.Data.GetData(DataFormats.FileDrop) as string[];if(paths!=null)manager.AddPaths(Group,paths);}catch(Exception ex){MessageBox.Show(ex.Message,"无法添加");}};DragEnter+=enter;DragDrop+=drop;items.DragEnter+=enter;items.DragDrop+=drop;
  var menu=new ContextMenuStrip();menu.Items.Add("添加文件或软件快捷方式…",null,delegate{AddFiles();});menu.Items.Add("添加文件夹…",null,delegate{using(var d=new FolderBrowserDialog{Description="选择要固定的文件夹"})if(d.ShowDialog()==DialogResult.OK)manager.AddPaths(Group,new[]{d.SelectedPath});});menu.Items.Add("重命名分区…",null,delegate{string name=PanelManager.Ask("重命名分区",Group.Name);if(!String.IsNullOrWhiteSpace(name)){Group.Name=name;title.Text=name;Text="桌面分区 · "+name;manager.Save();}});menu.Items.Add("新建分区…",null,delegate{manager.AddGroup();});menu.Items.Add("打开桌面净境设置",null,delegate{openSettings();});menu.Items.Add("移除此分区（保留原文件）",null,delegate{if(MessageBox.Show("只移除分区和入口，原文件保留。继续？","移除分区",MessageBoxButtons.YesNo)==DialogResult.Yes){manager.Config.Groups.Remove(Group);manager.Save();manager.Windows.Remove(this);Dispose();}});ContextMenuStrip=menu;header.ContextMenuStrip=menu;title.ContextMenuStrip=menu;items.ContextMenuStrip=menu;RenderItems();
 }
 void AddFiles(){using(var d=new OpenFileDialog{Title="固定文件或软件快捷方式",Filter="所有文件|*.*",Multiselect=true,DereferenceLinks=false})if(d.ShowDialog()==DialogResult.OK)manager.AddPaths(Group,d.FileNames);}
 void Launch(PanelEntry entry){try{if(!File.Exists(entry.Path)&&!Directory.Exists(entry.Path))throw new IOException("原项目已移动或不存在。请移除这个入口，再添加新位置。\n"+entry.Path);Process.Start(new ProcessStartInfo(entry.Path){UseShellExecute=true});}catch(Exception ex){MessageBox.Show(ex.Message,"无法打开 "+entry.Name);}}
 public void RenderItems(){foreach(Control c in items.Controls.Cast<Control>().ToArray())c.Dispose();items.Controls.Clear();title.Text=Group.Name+"   "+Group.Items.Count;if(Group.Items.Count==0){items.Controls.Add(new Label{Text="把常用文件或快捷方式拖到这里\n也可以点 + 添加，或右键添加文件夹",ForeColor=Color.FromArgb(169,185,204),AutoSize=true,Padding=new Padding(8,24,0,0)});return;}
  foreach(var entry in Group.Items){var tile=new EntryTile{Text=entry.Name,Width=96,Height=86,Margin=new Padding(3),BackColor=baseColor,ForeColor=fg,Cursor=Cursors.Hand};tile.Entry=entry;tile.AccessibleName=entry.Name;tile.AccessibleRole=AccessibleRole.PushButton;tile.TabStop=true;try{using(Icon icon=Directory.Exists(entry.Path)?SystemIcons.WinLogo:Icon.ExtractAssociatedIcon(entry.Path))tile.IconImage=icon.ToBitmap();}catch{tile.IconImage=SystemIcons.Application.ToBitmap();}tips.SetToolTip(tile,entry.Name+"\n"+entry.Path+"\n双击打开");tile.DoubleClick+=delegate{Launch(entry);};tile.KeyDown+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.Enter)Launch(entry);};
   var menu=new ContextMenuStrip();menu.Items.Add("打开",null,delegate{Launch(entry);});menu.Items.Add("打开所在位置",null,delegate{try{Process.Start("explorer.exe","/select,\""+entry.Path+"\"");}catch(Exception ex){MessageBox.Show(ex.Message);}});menu.Items.Add("修改显示名称…",null,delegate{string name=PanelManager.Ask("修改入口名称",entry.Name);if(!String.IsNullOrWhiteSpace(name)){entry.Name=name;manager.Refresh(Group);}});var move=new ToolStripMenuItem("移到其他分区");foreach(var target in manager.Config.Groups.Where(x=>x!=Group)){PanelGroup dest=target;move.DropDownItems.Add(dest.Name,null,delegate{if(!dest.Items.Any(x=>String.Equals(x.Path,entry.Path,StringComparison.OrdinalIgnoreCase)))dest.Items.Add(entry);Group.Items.Remove(entry);manager.Refresh(dest);manager.Refresh(Group);});}menu.Items.Add(move);menu.Items.Add("移除入口（不删除文件）",null,delegate{Group.Items.Remove(entry);manager.Refresh(Group);});tile.ContextMenuStrip=menu;items.Controls.Add(tile);
  }
 }
 protected override void Dispose(bool disposing){if(disposing)tips.Dispose();base.Dispose(disposing);}
}
public class EntryTile:Control {
 public Image IconImage;public PanelEntry Entry;bool hover;
 public EntryTile(){SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.StandardDoubleClick,true);MouseEnter+=delegate{hover=true;Invalidate();};MouseLeave+=delegate{hover=false;Invalidate();};}
 protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);if(hover||Focused)using(var b=new SolidBrush(Color.FromArgb(48,66,87)))e.Graphics.FillRectangle(b,ClientRectangle);if(IconImage!=null)e.Graphics.DrawImage(IconImage,(Width-30)/2,7,30,30);TextRenderer.DrawText(e.Graphics,Text,Font,new Rectangle(3,44,Width-6,38),ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.WordBreak|TextFormatFlags.EndEllipsis);}
 protected override void Dispose(bool disposing){if(disposing){if(IconImage!=null)IconImage.Dispose();if(ContextMenuStrip!=null)ContextMenuStrip.Dispose();}base.Dispose(disposing);}
}
