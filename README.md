# 这是一个未发布的Fate主题chrome主页扩展 
几年前搜Fate时找到的，因不满线上功能直接把index和css拷贝下来自己补充了壁纸切换和网页导航js。最近让AI更新到了V3，还有重构了代码。[以前的代码有点能跑就行](main.82e72700.js.png)，可惜不能发布。

## 壁纸
默认带有12张Fate壁纸
### 订阅
由于扩展程序不能随意访问网站，因此只能定义本地服务器。
或者是在manifest添加网址：
```js
"host_permissions": [
      "*://www.google.com/*",
      "*://127.0.0.1/*",
      "*://localhost/*"
   ]
```
### 订阅方式
- Group Name 无要求。
- URL Path Nas服务的网站，
- Image IDs (semicolon-separated) 图片名称，用‘；’分隔。
  最终的url是Path和Id直接拼起来，所以可以选择id带上路径，path只填ip。

# An Unreleased Fate-Themed Chrome Homepage Extension
Originally found while searching for Fate content. Dissatisfied with existing online features, I directly copied the index and CSS files, then added custom wallpaper switching and web navigation JS. Recently used AI to upgrade to V3 and refactored the code. Old code was barely functional – pity it can't be published.

## Wallpapers
Includes 12 Fate wallpapers by default

### Subscription
Extensions cannot freely access external websites, so only local server resources can be subscribed to.
Alternatively, whitelist domains in manifest:

```js
"host_permissions": [
      "*://www.google.com/*",
      "*://127.0.0.1/*",
      "*://localhost/*"
   ]
```

### Subscription Method
Group Name: No restrictions

URL Path: NAS service address

Image IDs (semicolon-separated): Filenames delimited by ;
Final URLs concatenate Path + ID directly. Use path in IDs for flexibility (e.g. Path only contains IP)