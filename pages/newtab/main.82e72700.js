class App {
    constructor() {
        this.dom = {
            appContainer: document.getElementById('app-container'),
            wallpaper: document.getElementById('wallpaper'),
            // Search
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('search-btn'),
            // Clock
            clockTime: document.getElementById('clock-time'),
            clockDate: document.getElementById('clock-date'),
            // Icons
            iconsContainer: document.getElementById('icons-container'),
            iconsPrevBtn: document.getElementById('icons-prev'),
            iconsNextBtn: document.getElementById('icons-next'),
            // Gallery
            galleryDialog: document.getElementById('gallery-dialog'),
            galleryGrid: document.getElementById('gallery-grid'),
            galleryCloseBtn: document.getElementById('gallery-close-btn'),
            galleryActions: document.getElementById('gallery-actions'),
            galleryDeleteGroupBtn: document.getElementById('gallery-delete-group-btn'),
            // Settings
            settingsBtn: document.getElementById('settings-btn'),
            settingsPanel: document.getElementById('settings-panel'),
            settingsContent: document.getElementById('settings-content'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            addGroupBtn: document.getElementById('add-group-btn'),
            groupNameInput: document.getElementById('group-name-input'),
            groupPathInput: document.getElementById('group-path-input'),
            groupItemsInput: document.getElementById('group-items-input'),
            randomFromAllCheckbox: document.getElementById('random-from-all-checkbox'),
            // Custom Links
            addLinkBtn: document.getElementById('add-link-btn'),
            customLinkTitleInput: document.getElementById('custom-link-title-input'),
            customLinkUrlInput: document.getElementById('custom-link-url-input'),
            customLinksList: document.getElementById('custom-links-list'),
            nasLinkCheckbox: document.getElementById('nas-link-checkbox'),
            // Custom Icons
            customIconsGrid: document.getElementById('custom-icons-grid'),
            customIconEditSection: document.getElementById('custom-icon-edit-section'),
            customIconEditTitle: document.getElementById('custom-icon-edit-title'),
            customIconEditUrlInput: document.getElementById('custom-icon-edit-url-input'),
            customIconEditFileInput: document.getElementById('custom-icon-edit-file-input'),
            customIconEditSaveBtn: document.getElementById('custom-icon-edit-save-btn'),
            customIconEditRemoveBtn: document.getElementById('custom-icon-edit-remove-btn'),
            customIconEditCancelBtn: document.getElementById('custom-icon-edit-cancel-btn'),
            // Templates
            iconTemplate: document.getElementById('icon-template'),
            galleryItemTemplate: document.getElementById('gallery-item-template'),
            settingItemTemplate: document.getElementById('setting-item-template'),
            customLinkItemTemplate: document.getElementById('custom-link-item-template'),
        };

        this.state = {
            settings: {
                autohide: true,
                autohide_current: 5000,
                autoswitch: true,
                autoswitch_current: 6000,
                like_current: 'default',
                group_list: [],
                random_from_all_groups: false,
            },
            customLinks: [],
            customIcons: {},
            timers: {
                wallpaper: null,
                hideUI: null,
            },
            lastDate: null,
            nasIconsVisible: false,
            nasLinks: [],
        };

        this.isIconScrolling = false;

        this.settingsConfig = [
            { id: 'autohide', name: 'Auto-hide UI', contentLabel: 'Delay', unit: 'ms', options: [3000, 5000, 10000, 15000] },
            { id: 'autoswitch', name: 'Auto-switch Wallpaper', contentLabel: 'Interval', unit: 'ms', options: [3000, 6000, 9000, 12000, 16000] },
            { id: 'like', name: 'Wallpaper Subscription', contentLabel: 'Group', unit: '', options: [] }
        ];

        this._debouncedSlideIcons = this._debounce((direction) => {
            this._slideIcons(direction);
        }, 200);
    }

    async init() {
        await this._loadState();
        this._applySettings();
        await this._renderBaseUI();
        this._attachEventListeners();
    }

    // --- RENDER METHODS ---

    async _renderBaseUI() {
        this._startClock();
        await this._renderIcons();
    }

    _renderIcons() {
        return new Promise(resolve => {
            this.dom.iconsContainer.innerHTML = '';
            const fragment = document.createDocumentFragment();

            // Special icons
            const galleryBtn = this._createIcon({ title: 'Gallery', url: '#gallery' });
            const nasBtn = this._createIcon({ title: 'NAS', url: '#nas' });
            fragment.appendChild(galleryBtn);
            fragment.appendChild(nasBtn);

            // Custom links (non-NAS)
            this.state.customLinks
                .filter(link => !link.isNas)
                .forEach(link => {
                    const icon = this._createIcon(link);
                    fragment.appendChild(icon);
                });

            this.dom.iconsContainer.appendChild(fragment);

            // Top sites (appended asynchronously)
            chrome.topSites.get(sites => {
                const topSitesFragment = document.createDocumentFragment();
                const customUrls = new Set(this.state.customLinks.map(l => l.url));

                sites
                    .filter(site => !customUrls.has(site.url))
                    .forEach(site => {
                        const icon = this._createIcon(site);
                        topSitesFragment.appendChild(icon);
                    });

                this.dom.iconsContainer.appendChild(topSitesFragment);
                this._updateIconNav();
                resolve();
            });
        });
    }

    _createIcon({ title, url }) {
        const iconClone = this.dom.iconTemplate.content.cloneNode(true);
        const link = iconClone.querySelector('a');
        const img = iconClone.querySelector('i');
        const label = iconClone.querySelector('span');

        link.href = url;
        link.title = title;
        label.textContent = title;

        label.style.visibility = "hidden";
        link.addEventListener("mouseover", function () {
            label.style.visibility = "visible";
        });

        link.addEventListener("mouseout", function () {
            label.style.visibility = "hidden";
        });

        const customIcon = this.state.customIcons[url];
        if (customIcon) {
            img.style.backgroundImage = `url(${customIcon})`;
            img.style.backgroundSize = 'cover';
        } else if (url === '#gallery') {
            img.style.backgroundImage = 'url(imgs/image-wallpaper-lib.000ee690.png)';
            img.style.backgroundSize = 'cover'
            link.dataset.action = 'toggle-gallery';
        } else if (url === '#nas') {
            img.style.backgroundImage = 'url(imgs/image-wallpaper-lib.png)';
            img.style.backgroundSize = 'cover'
            link.dataset.action = 'toggle-nas';
        } else {
            try {
                const hostname = new URL(url).hostname;
                img.style.backgroundImage = `url(https://www.google.com/s2/favicons?sz=64&domain=${hostname})`;
            } catch (error) {
                console.error(`Invalid URL for icon: ${url}`, error);
                img.style.backgroundImage = 'url(imgs/icon-fallback.png)';
            }
        }

        return iconClone;
    }

    _renderGallery() {
        this.dom.galleryGrid.innerHTML = '';

        const groupsToUse = this.state.settings.random_from_all_groups
            ? this.state.settings.group_list
            : [this.state.settings.group_list.find(g => g.name === this.state.settings.like_current)].filter(Boolean);

        if (!groupsToUse || groupsToUse.length === 0) {
            return;
        }

        const fragment = document.createDocumentFragment();
        groupsToUse.forEach(group => {
            if (!group || !group.item) return;

            group.item.forEach(itemPath => {
                const clone = this.dom.galleryItemTemplate.content.cloneNode(true);
                const btn = clone.querySelector('button');
                const img = clone.querySelector('img');
                const fullPath = itemPath.startsWith('http') ? itemPath : (group.path || '') + itemPath;
                img.src = fullPath;
                btn.dataset.path = fullPath;
                fragment.appendChild(clone);
            });
        });
        this.dom.galleryGrid.appendChild(fragment);
    }

    _renderSettings() {
        const settingsContainer = this.dom.settingsContent.querySelector('.setting-item')?.parentNode || this.dom.settingsContent;
        settingsContainer.querySelectorAll('.setting-item').forEach(el => el.remove());

        const fragment = document.createDocumentFragment();
        this.settingsConfig.forEach(config => {
            if (config.id === 'like') {
                config.options = this.state.settings.group_list.map(g => g.name);
            }
            const clone = this.dom.settingItemTemplate.content.cloneNode(true);
            const settingItem = clone.querySelector('.setting-item');
            const label = clone.querySelector('.setting-label');
            const checkbox = clone.querySelector('.switch-checkbox');
            const contentLabel = clone.querySelector('.form-item-label');
            const select = clone.querySelector('.select-box');
            const contentDiv = clone.querySelector('.setting-item-content');

            settingItem.dataset.id = config.id;
            label.textContent = config.name;

            const isEnabled = (config.id === 'like') || (this.state.settings[config.id] ?? false);
            checkbox.checked = isEnabled;

            if (config.id === 'like') {
                settingItem.querySelector('.switch').style.display = 'none';
            }

            contentDiv.classList.toggle('disabled', !isEnabled);

            contentLabel.textContent = config.contentLabel;

            config.options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt;
                optionEl.textContent = `${opt}${config.unit}`;
                select.appendChild(optionEl);
            });
            select.value = this.state.settings[`${config.id}_current`];

            fragment.appendChild(clone);
        });
        settingsContainer.prepend(fragment);
    }

    _renderCustomLinksList() {
        this.dom.customLinksList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        this.state.customLinks.forEach(link => {
            const clone = this.dom.customLinkItemTemplate.content.cloneNode(true);
            const titleSpan = clone.querySelector('.custom-link-title');
            titleSpan.textContent = link.title;

            if (link.isNas) {
                const nasTag = document.createElement('span');
                nasTag.className = 'nas-tag';
                nasTag.textContent = 'NAS';
                titleSpan.appendChild(nasTag);
            }

            clone.querySelector('.custom-link-url').textContent = link.url;
            clone.querySelector('.delete-link-btn').dataset.url = link.url;
            clone.querySelector('i').classList.add('icon-delete');
            fragment.appendChild(clone);
        });
        this.dom.customLinksList.appendChild(fragment);
    }

    _renderCustomIconSettingsGrid() {
        this.dom.customIconsGrid.innerHTML = ''; // Clear immediately
        const customUrls = new Set(this.state.customLinks.map(l => l.url));

        const createSettingsIcon = ({ title, url }) => {
            const iconClone = this.dom.iconTemplate.content.cloneNode(true);
            const link = iconClone.querySelector('a.icon-item');
            const img = iconClone.querySelector('i.icon-img');
            const label = iconClone.querySelector('span.icon-label');

            link.removeAttribute('href');
            link.setAttribute('role', 'button');
            link.setAttribute('tabindex', '0');
            link.dataset.url = url;
            link.dataset.title = title;
            label.textContent = title;
            label.style.visibility = 'visible';
            label.style.color = '#41484fff';

            const customIconData = this.state.customIcons[url];
            if (customIconData) {
                img.style.backgroundImage = `url(${customIconData})`;
                img.style.backgroundSize = 'cover';
            } else {
                try {
                    const hostname = new URL(url).hostname;
                    img.style.backgroundImage = `url(https://www.google.com/s2/favicons?sz=64&domain=${hostname})`;
                } catch (e) {
                    img.style.backgroundImage = 'url(imgs/icon-fallback.png)';
                }
            }

            return iconClone;
        };

        // Combine custom links with top sites before rendering
        chrome.topSites.get(sites => {
            const allIconData = [...this.state.customLinks];
            const topSitesData = sites.filter(site => !customUrls.has(site.url));
            const combinedData = [...allIconData, ...topSitesData];

            const settingsGridFragment = document.createDocumentFragment();
            combinedData.forEach(iconData => {
                settingsGridFragment.appendChild(createSettingsIcon(iconData));
            });

            this.dom.customIconsGrid.innerHTML = ''; // Ensure it's empty before append
            this.dom.customIconsGrid.appendChild(settingsGridFragment);
        });
    }

    // --- EVENT HANDLERS ---

    _attachEventListeners() {
        document.addEventListener('mousemove', () => this._handleActivity());
        document.addEventListener('keydown', () => this._handleActivity());

        // Search
        this.dom.searchBtn.addEventListener('click', () => this._handleSearch());
        this.dom.searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._handleSearch(e.ctrlKey);
        });

        // Icons
        this.dom.iconsContainer.addEventListener('click', e => this._handleIconClick(e));
        this.dom.iconsContainer.addEventListener('scroll', () => this._updateIconNav());
        this.dom.iconsContainer.addEventListener('wheel', e => this._handleIconScroll(e));
        this.dom.iconsPrevBtn.addEventListener('click', () => this._slideIcons('prev'));
        this.dom.iconsNextBtn.addEventListener('click', () => this._slideIcons('next'));

        // Settings Panel
        this.dom.settingsBtn.addEventListener('click', () => this._toggleSettings(true));
        this.dom.settingsCloseBtn.addEventListener('click', () => this._toggleSettings(false));
        this.dom.settingsContent.addEventListener('change', e => this._handleSettingChange(e));

        // Settings - Add Group
        this.dom.addGroupBtn.addEventListener('click', () => this._addGroup());
        this.dom.groupNameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._loadGroupForEditing();
            }
        });
        this.dom.randomFromAllCheckbox.addEventListener('change', () => this._handleRandomFromAllChange());

        // Gallery
        this.dom.galleryCloseBtn.addEventListener('click', () => this.dom.galleryDialog.close());
        this.dom.galleryGrid.addEventListener('click', e => this._handleGalleryClick(e));
        this.dom.galleryDeleteGroupBtn.addEventListener('click', () => this._handleDeleteGroup());

        // Settings - Custom Links
        this.dom.addLinkBtn.addEventListener('click', () => this._addCustomLink());
        this.dom.customLinksList.addEventListener('click', e => this._handleCustomLinkListClick(e));

        // Settings - Custom Icons
        this.dom.customIconsGrid.addEventListener('click', e => this._handleCustomIconGridClick(e));
        this.dom.customIconEditCancelBtn.addEventListener('click', () => this._hideCustomIconEditSection());
        this.dom.customIconEditSaveBtn.addEventListener('click', () => this._handleCustomIconSave());
        this.dom.customIconEditRemoveBtn.addEventListener('click', () => this._handleCustomIconRemove());
        this.dom.customIconEditFileInput.addEventListener('change', () => this._handleCustomIconFileSelect());
    }

    _handleSearch(useAlternate = false) {
        const query = this.dom.searchInput.value.trim();
        if (!query) return;
        const searchEngines = {
            default: {
                url: 'https://cn.bing.com/search',
                param: 'q'
            },
            alternate: {
                url: 'https://search.bilibili.com/all',
                param: 'keyword'
            }
        };
        const engine = useAlternate ? searchEngines.alternate : searchEngines.default;
        const searchUrl = `${engine.url}?${engine.param}=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }

    _handleIconClick(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const action = link.dataset.action;
        if (action) {
            e.preventDefault();
            if (action === 'toggle-gallery') this._toggleGallery(true);
            if (action === 'toggle-nas') this._toggleNasIcons();
        } else if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
            // This is an external navigation link
            e.preventDefault();
            window.location.replace(link.href);
        }
    }

    _handleIconScroll(e) {
        const delta = e.deltaY || e.deltaX;
        
        if (Math.abs(delta) > 1) {
            e.preventDefault();
            const direction = delta > 0 ? 'next' : 'prev';
            this._debouncedSlideIcons(direction);
        }
    }

    _handleGalleryClick(e) {
        const btn = e.target.closest('.gallery-item-btn');
        if (!btn) return;
        const path = btn.dataset.path;
        this._setWallpaper(path);
        this.dom.galleryDialog.close();
    }

    _handleDeleteGroup() {
        const currentGroup = this.state.settings.like_current;
        if (currentGroup === 'default' || this.state.settings.random_from_all_groups) {
            return;
        }

        if (!confirm(`Are you sure you want to delete the "${currentGroup}" group? This cannot be undone.`)) {
            return;
        }

        this.state.settings.group_list = this.state.settings.group_list.filter(g => g.name !== currentGroup);
        this.state.settings.like_current = 'default';

        this._saveSettings();
        this._applySettings();

        if (this.dom.settingsPanel.classList.contains('open')) {
            this._renderSettings();
        }

        this.dom.galleryDialog.close();
    }

    _handleSettingChange(e) {
        const target = e.target;
        const settingItem = target.closest('.setting-item');
        if (!settingItem) return;

        const id = settingItem.dataset.id;
        const isSwitch = target.classList.contains('switch-checkbox');
        const isSelect = target.classList.contains('select-box');

        if (isSwitch) {
            this.state.settings[id] = target.checked;
            settingItem.querySelector('.setting-item-content').classList.toggle('disabled', !target.checked);
        }
        if (isSelect) {
            const value = isNaN(target.value) ? target.value : parseInt(target.value, 10);
            this.state.settings[`${id}_current`] = value;
        }

        this._saveSettings();
        this._applySettings();
    }

    _handleRandomFromAllChange() {
        const isChecked = this.dom.randomFromAllCheckbox.checked;
        this.state.settings.random_from_all_groups = isChecked;

        if (isChecked) {
            this.state.settings.like_current = 'default';
        }

        this._saveSettings();
        this._applySettings();
    }


    _handleCustomLinkListClick(e) {
        const deleteBtn = e.target.closest('.delete-link-btn');
        if (deleteBtn) {
            this._deleteCustomLink(deleteBtn.dataset.url);
        }
    }

    _handleActivity() {
        if (!this.state.settings.autohide) return;
        this.dom.appContainer.classList.remove('hidden');
        this._resetHideTimer();
    }

    _handleCustomIconGridClick(e) {
        const icon = e.target.closest('.icon-item');
        if (icon && icon.dataset.url) {
            const url = icon.dataset.url;
            const title = icon.dataset.title;

            this.dom.customIconEditSection.dataset.editingUrl = url;
            this.dom.customIconEditTitle.textContent = `Customize: ${title}`;
            this.dom.customIconEditRemoveBtn.style.display = this.state.customIcons[url] ? 'inline-block' : 'none';
            this.dom.customIconEditUrlInput.value = '';
            this.dom.customIconEditFileInput.value = '';

            this.dom.customIconEditSection.style.display = 'block';
            this.dom.customIconEditSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    async _handleCustomIconSave() {
        const url = this.dom.customIconEditSection.dataset.editingUrl;
        if (!url) return;

        const iconDataSource = this.dom.customIconEditUrlInput.value.trim();

        if (!iconDataSource) {
            alert('Please provide an image URL or upload a file.');
            return;
        }

        // A simple check for valid URL or data URI.
        if (iconDataSource.startsWith('http://') || iconDataSource.startsWith('https://') || iconDataSource.startsWith('data:image')) {
            this.state.customIcons[url] = iconDataSource;
            await this._saveCustomIcons();
            this._hideCustomIconEditSection();
        } else {
            alert('Please enter a valid image URL or choose a file.');
        }
    }

    async _handleCustomIconRemove() {
        const url = this.dom.customIconEditSection.dataset.editingUrl;
        if (url && this.state.customIcons[url]) {
            delete this.state.customIcons[url];
            await this._saveCustomIcons();
        }
        this._hideCustomIconEditSection();
    }

    _handleCustomIconFileSelect() {
        const fileInput = this.dom.customIconEditFileInput;
        const urlInput = this.dom.customIconEditUrlInput;

        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                urlInput.value = e.target.result;
            };

            reader.onerror = () => {
                alert('Error reading file. Please try again.');
                urlInput.value = '';
            }

            reader.readAsDataURL(file);
        }
    }


    // --- FEATURE LOGIC ---

    _startClock() {
        this._updateClock();
        setInterval(() => this._updateClock(), 15000);
    }

    _updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        // 只有当时间字符串改变时才更新DOM
        if (this._lastTimeStr !== timeStr) {
            this.dom.clockTime.textContent = timeStr;
            this._lastTimeStr = timeStr;
        }

        if (now.getDate() !== this.state.lastDate) {
            const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
            const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${week[now.getDay()]}`;
            this.dom.clockDate.textContent = dateStr;
            this.state.lastDate = now.getDate();
        }
    }

    _setWallpaper(path) {
        const img = new Image();
        img.onload = () => {
            this.dom.wallpaper.style.backgroundImage = `url("${path}")`;
        };

        img.onerror = () => {
            console.error(`Failed to load wallpaper: ${path}`);
        };
        img.src = path; // This starts the image download.
    }

    _setRandomWallpaper() {
        const groupsToUse = this.state.settings.random_from_all_groups ? this.state.settings.group_list : [this.state.settings.group_list.find(g => g.name === this.state.settings.like_current)];

        const allWallpapers = groupsToUse.flatMap(group => {
            if (!group || !group.item || group.item.length === 0) return [];
            return group.item.map(itemPath =>
                itemPath.startsWith('http') ? itemPath : (group.path || '') + itemPath
            );
        });

        if (allWallpapers.length === 0) return;

        const randomIndex = Math.floor(Math.random() * allWallpapers.length);
        const wallpaperUrl = allWallpapers[randomIndex];
        this._setWallpaper(wallpaperUrl);
    }

    _toggleSettings(open) {
        if (open) {
            this._renderSettings();
            this._renderCustomLinksList();
            this._renderCustomIconSettingsGrid();
            this.dom.randomFromAllCheckbox.checked = this.state.settings.random_from_all_groups;
            this.dom.settingsPanel.classList.add('open');
        } else {
            this._hideCustomIconEditSection();
            this.dom.settingsPanel.classList.remove('open');
        }
    }

    _toggleGallery(open) {
        if (open) {
            this._renderGallery();

            const shouldShowDelete = !this.state.settings.random_from_all_groups && this.state.settings.like_current !== 'default';
            this.dom.galleryActions.style.display = shouldShowDelete ? 'block' : 'none';

            this.dom.galleryDialog.showModal();
        } else {
            this.dom.galleryDialog.close();
        }
    }

    _toggleNasIcons() {
        if (!this._nasBtnElement) {
            this._nasBtnElement = this.dom.iconsContainer.querySelector('a[data-action="toggle-nas"]');
        }

        if (this.state.nasIconsVisible) {
            this.state.nasLinks.forEach(el => el.remove());
            this.state.nasLinks = [];
        } else {
            const fragment = document.createDocumentFragment();
            const customNasLinks = this.state.customLinks.filter(link => link.isNas);
            const customUrls = new Set(customNasLinks.map(link => link.url));

            // Start with custom links, then add hardcoded ones that are not duplicates
            const allNasLinks = [...customNasLinks];
            hardcodedNasLinks.forEach(hardcodedLink => {
                if (!customUrls.has(hardcodedLink.url)) {
                    allNasLinks.push(hardcodedLink);
                }
            });

            allNasLinks.forEach(link => {
                const iconClone = this._createIcon(link);
                const iconElement = iconClone.querySelector('.icon-item');
                if (iconElement) {
                    this.state.nasLinks.push(iconElement);
                }
                fragment.appendChild(iconClone);
            });
        }
        this.state.nasIconsVisible = !this.state.nasIconsVisible;
        this._updateIconNav();
    }

    _slideIcons(dir) {
        const container = this.dom.iconsContainer;
        const scrollAmount = container.clientWidth;
        container.scrollBy({
            left: dir === 'next' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
    }

    _updateIconNav() {
        const { scrollLeft, scrollWidth, clientWidth } = this.dom.iconsContainer;
        this.dom.iconsPrevBtn.disabled = scrollLeft < 10;
        this.dom.iconsNextBtn.disabled = scrollLeft > scrollWidth - clientWidth - 10;
    }

    _loadGroupForEditing() {
        const name = this.dom.groupNameInput.value.trim();
        if (!name) return;

        const existingGroup = this.state.settings.group_list.find(g => g.name === name);

        if (existingGroup) {
            this.dom.groupPathInput.value = existingGroup.path || '';
            this.dom.groupItemsInput.value = existingGroup.item.join(';');
        }
    }

    _addGroup() {
        const name = this.dom.groupNameInput.value.trim();
        let path = this.dom.groupPathInput.value.trim();
        const itemsRaw = this.dom.groupItemsInput.value.trim();

        if (!name || !itemsRaw) return alert("Group Name and Image IDs are required.");
        if (path && !path.endsWith('/')) path += '/';

        const items = itemsRaw.split(';').map(s => s.trim()).filter(Boolean);

        const newGroup = { name, path, item: items };
        const existingIndex = this.state.settings.group_list.findIndex(g => g.name === name);

        if (existingIndex > -1) {
            this.state.settings.group_list[existingIndex] = newGroup;
        } else {
            this.state.settings.group_list.push(newGroup);
        }

        this.state.settings.like_current = name;
        this.dom.groupNameInput.value = '';
        this.dom.groupPathInput.value = '';
        this.dom.groupItemsInput.value = '';

        this._saveSettings();
        this._applySettings();
        this._renderSettings();
    }

    _validateUrl(url) {
        try {
            const urlObj = new URL(url);
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch (e) {
            return false;
        }
    }

    _addCustomLink() {
        const title = this.dom.customLinkTitleInput.value.trim();
        let url = this.dom.customLinkUrlInput.value.trim();
        const isNas = this.dom.nasLinkCheckbox.checked;

        if (!title || !url) {
            alert('标题和URL都不能为空');
            return;
        }

        if (!this._validateUrl(url)) {
            alert('请输入有效的 http 或 https URL');
            return;
        }

        if (this.state.customLinks.some(link => link.url === url)) {
            return alert('This URL has already been added.');
        }

        this.state.customLinks.push({ title, url, isNas });
        this.dom.customLinkTitleInput.value = '';
        this.dom.customLinkUrlInput.value = '';
        this.dom.nasLinkCheckbox.checked = false;

        this._saveCustomLinks();
        this._renderCustomLinksList();

        // If NAS icons are currently displayed, refresh them to show the new link
        if (isNas && this.state.nasIconsVisible) {
            this._toggleNasIcons(); // This hides them
            this._toggleNasIcons(); // This shows them again, now including the new one
        }
    }

    _deleteCustomLink(url) {
        const linkToDelete = this.state.customLinks.find(link => link.url === url);

        this.state.customLinks = this.state.customLinks.filter(link => link.url !== url);
        this._saveCustomLinks();
        this._renderCustomLinksList();

        // If NAS icons are currently displayed and we deleted a NAS link, refresh them
        if (linkToDelete && linkToDelete.isNas && this.state.nasIconsVisible) {
            this._toggleNasIcons(); // hide
            this._toggleNasIcons(); // show
        }
    }

    _hideCustomIconEditSection() {
        this.dom.customIconEditSection.style.display = 'none';
        this.dom.customIconEditSection.dataset.editingUrl = '';
        this.dom.customIconEditUrlInput.value = '';
        this.dom.customIconEditFileInput.value = '';
    }

    // --- SETTINGS & STATE ---

    async _loadState() {
        const syncPromise = new Promise(resolve => {
            chrome.storage.sync.get({ ...this.state.settings, customLinks: [] }, result => {
                const { customLinks, ...settings } = result;
                this.state.settings = { ...this.state.settings, ...settings };
                this.state.customLinks = customLinks || [];

                if (!this.state.settings.group_list || this.state.settings.group_list.length === 0) {
                    this.state.settings.group_list = [{
                        name: 'default',
                        path: 'pictures/',
                        item: ['0.png', '1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png', '10.png', '11.png', '12.png']
                    }];
                    this._saveSettings();
                }
                resolve();
            });
        });

        const localPromise = new Promise(resolve => {
            chrome.storage.local.get({ customIcons: {} }, result => {
                this.state.customIcons = result.customIcons || {};
                resolve();
            });
        });

        await Promise.all([syncPromise, localPromise]);
    }

    _saveSettings() {
        chrome.storage.sync.set(this.state.settings);
    }

    _saveCustomLinks() {
        chrome.storage.sync.set({ customLinks: this.state.customLinks }, () => {
            this._renderIcons();
        });
    }

    _saveCustomIcons() {
        return new Promise(resolve => {
            chrome.storage.local.set({ customIcons: this.state.customIcons }, async () => {
                const wasNasVisible = this.state.nasIconsVisible;

                // If NAS icons were open, we must hide them to reset the state before the main render,
                // which clears the container and invalidates the old icon elements.
                if (wasNasVisible) {
                    this._toggleNasIcons(); // This hides them and sets nasIconsVisible to false.
                }

                // Render the main icons. This clears the container and lays the groundwork.
                await this._renderIcons();

                // If they were originally visible, show them again (now refreshed with the new custom icon).
                if (wasNasVisible) {
                    this._toggleNasIcons(); // This shows them, as nasIconsVisible is now false.
                }

                // Refresh the settings grid if it's open to reflect the changes.
                if (this.dom.settingsPanel.classList.contains('open')) {
                    this._renderCustomIconSettingsGrid();
                }
                resolve();
            });
        });
    }

    _applySettings() {
        // Wallpaper
        clearInterval(this.state.timers.wallpaper);
        if (this.state.settings.autoswitch) {
            this._setRandomWallpaper();
            this.state.timers.wallpaper = setInterval(
                () => this._setRandomWallpaper(),
                this.state.settings.autoswitch_current
            );
        } else {
            this._setRandomWallpaper();
        }

        // Auto-hide UI
        this._resetHideTimer();
    }

    _resetHideTimer() {
        clearTimeout(this.state.timers.hideUI);
        if (this.state.settings.autohide) {
            this.state.timers.hideUI = setTimeout(() => {
                this.dom.appContainer.classList.add('hidden');
            }, this.state.settings.autohide_current);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});