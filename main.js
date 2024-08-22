// 전역 변수 선언
let isResizing = false;
let isDraggingCanvas = false;
let isContextMenuOpen = false;
let activeMemo = null;
let lastX = 0;
let lastY = 0;
let scale = 1;
let memoOffsetX = 0;
let memoOffsetY = 0;
let highestZIndex = 1;
let lowestZIndex = 1;

document.addEventListener('DOMContentLoaded', (event) => {
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const importFileInput = document.getElementById('importFileInput');
    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const menuIcon = document.getElementById('menu-icon');
    const menu = document.getElementById('menu');
    const resetMemosButton = document.getElementById('resetMemosButton');
    

    createFloatingBar();   
    loadMemos();
    loadCanvasSettings();

    // Reset All Memos 버튼 이벤트 리스너 추가
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.classList.contains('memo-content') && !activeElement.readOnly) {
            if (e.ctrlKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                document.execCommand('strikeThrough');
            } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                document.execCommand('bold');
            }
        }
    });

    if (exportButton) {
        exportButton.addEventListener('click', exportMemos);
    }

    if (importButton) {
        importButton.addEventListener('click', () => importFileInput.click());
    }

    if (importFileInput) {
        importFileInput.addEventListener('change', importMemos);
    }

    if (canvas) {
        canvas.addEventListener('mousedown', function(e) {
            if (e.button === 0) {
                startDraggingCanvas(e);
            }
        });
        canvas.addEventListener('mousemove', dragCanvas);
        canvas.addEventListener('mouseup', stopDraggingCanvas);
        canvas.addEventListener('mouseleave', stopDraggingCanvas);
        canvas.addEventListener('wheel', zoom);
    }

    if (canvasContent) {
        canvasContent.addEventListener('dblclick', handleDoubleClick);
    }

    if (menuIcon) {
        menuIcon.addEventListener('click', toggleMenu);
    }

    if (menu) {
        document.getElementById('background-selector').addEventListener('change', function () {
            changeBackground(this.value);
        });
        document.getElementById('canvas-size-selector').addEventListener('change', function () {
            setCanvasSize(this.value);
        });
        document.getElementById('canvas-orientation-selector').addEventListener('change', function () {
            setCanvasOrientation(this.value);
        });
        document.getElementById('applySizeButton').addEventListener('click', resizeCanvas);
    }

    if (resetMemosButton) {
        resetMemosButton.addEventListener('click', resetAllMemos);
    }


    // 함수들을 전역 스코프에 노출
    window.changeColor = changeColor;
    window.handleImageUpload = handleImageUpload;
    window.deleteMemo = deleteMemo;

    function createFloatingBar() {
        const floatingBar = document.createElement('div');
        floatingBar.id = 'floating-bar';
        floatingBar.style.position = 'absolute';
        floatingBar.style.display = 'none';
        floatingBar.style.zIndex = '10000';
        floatingBar.innerHTML = `
            <select id="font-select">
                <option value="Arial">Arial</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
            </select>
            <input type="color" id="color-picker">
            <input type="color" id="highlight-picker">
            <button id="bold-btn">B</button>
            <button id="strike-btn">S</button>
        `;
        document.body.appendChild(floatingBar);
        
        document.addEventListener('mouseup', (e) => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const memoContent = e.target.closest('.memo-content');
    
                if (memoContent && !memoContent.readOnly && selection.toString().length > 0) {
                    const memoRect = memoContent.getBoundingClientRect();
                    floatingBar.style.top = `${rect.bottom + window.scrollY}px`;
                    floatingBar.style.left = `${rect.left + window.scrollX}px`;
                    floatingBar.style.display = 'block';
                } else {
                    floatingBar.style.display = 'none';
                }
            }
        });
    
        document.getElementById('font-select').addEventListener('change', function() {
            applyStyle('font-family', this.value);
        });
    
        document.getElementById('color-picker').addEventListener('change', function() {
            applyStyle('color', this.value);
        });
    
        document.getElementById('highlight-picker').addEventListener('change', function() {
            applyStyle('background-color', this.value);
        });
    
        document.getElementById('bold-btn').addEventListener('click', function() {
            document.execCommand('bold');
        });
    
        document.getElementById('strike-btn').addEventListener('click', function() {
            document.execCommand('strikeThrough');
        });
    }

    function applyStyle(styleName, value) {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, value);
    }

    function handleDoubleClick(e) {
        if (e.target === canvasContent) {
            const canvasRect = canvas.getBoundingClientRect();
            const canvasTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
            const x = (e.clientX - canvasRect.left - canvasTransform.e) / scale;
            const y = (e.clientY - canvasRect.top - canvasTransform.f) / scale;
            createMemo(x, y);
            saveMemos();
        }
    }
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function createMemo(x, y, memoData = null) {
        if (memoData && memoData.id) {
            let existingMemo = document.getElementById(`memo-${memoData.id}`);
            if (existingMemo) {
                console.log(`Memo with id ${memoData.id} already exists. Skipping creation.`);
                return existingMemo;
            }
        }

        const memoWrapper = document.createElement('div');
        memoWrapper.className = 'memo-wrapper';
        memoWrapper.style.left = `${x}px`;
        memoWrapper.style.top = `${y}px`;
    
        const memoId = memoData ? memoData.id : generateUUID();
        memoWrapper.id = `memo-${memoId}`;
    
        memoWrapper.innerHTML = `
            <div class="memo-icons">
                <div class="color-icon" style="background-color: #ffff99;" onclick="changeColor(this, '#ffff99')"></div>
                <div class="color-icon" style="background-color: #ffcccb;" onclick="changeColor(this, '#ffcccb')"></div>
                <div class="color-icon" style="background-color: #ffffe0;" onclick="changeColor(this, '#ffffe0')"></div>
                <div class="color-icon" style="background-color: #e0ffff;" onclick="changeColor(this, '#e0ffff')"></div>
                <div class="color-icon" style="background-color: #98fb98;" onclick="changeColor(this, '#98fb98')"></div>
                <div class="color-icon" style="background-color: #dda0dd;" onclick="changeColor(this, '#dda0dd')"></div>
                <label for="image-upload-${memoId}" class="icon">🖼️</label>
                <input id="image-upload-${memoId}" type="file" accept="image/*" style="display: none;" onchange="handleImageUpload(this)">
                <div class="icon" onclick="deleteMemo(this)">✖️</div>
            </div>
            <div class="memo" style="width: ${memoData ? memoData.width : '200px'}; height: ${memoData ? memoData.height : '150px'}; background-color: ${memoData ? memoData.backgroundColor : '#ffff99'};">
                <textarea class="memo-content" ${memoData ? '' : 'readonly'}>${memoData ? memoData.content : ''}</textarea>
                <div class="image-container" style="display: none;">
                    <img src="" alt="Uploaded image">
                </div>
            </div>
            <div class="resize-handle">⤡</div>
        `;
    
        canvasContent.appendChild(memoWrapper);
    
        if (memoData && memoData.imageSrc) {
            const imageContainer = memoWrapper.querySelector('.image-container');
            const uploadedImage = imageContainer.querySelector('img');
            uploadedImage.src = memoData.imageSrc;
            imageContainer.style.display = 'flex';
            memoWrapper.querySelector('.memo-content').style.display = 'none';
        }
    
        addMemoEventListeners(memoWrapper);
        addDragListeners(memoWrapper);

        return memoWrapper;
    }

    // 메모 이벤트 리스너 추가 함수
    function addMemoEventListeners(memoWrapper) {
        const memoContent = memoWrapper.querySelector('.memo-content');
        const memo = memoWrapper.querySelector('.memo');
        let imageContainer = memoWrapper.querySelector('.image-container');
    
        memoWrapper.addEventListener('mouseenter', () => {
            memoWrapper.querySelector('.memo-icons').style.display = 'flex';
            memoWrapper.querySelector('.resize-handle').style.display = 'flex';
        });
    
        memoWrapper.addEventListener('mouseleave', () => {
            memoWrapper.querySelector('.memo-icons').style.display = 'none';
            memoWrapper.querySelector('.resize-handle').style.display = 'none';
        });
    
        memoWrapper.querySelector('.resize-handle').addEventListener('mousedown', startResizing);
        memoContent.addEventListener('dblclick', enableEditMode);
        memoContent.addEventListener('blur', disableEditMode);
        memoContent.addEventListener('input', saveMemos);
    
        // 이미지 컨테이너에 대한 이벤트 리스너 추가 (존재할 경우에만)
        if (imageContainer) {
            let img = imageContainer.querySelector('img');
            if (img) {
                img.draggable = false; // 이미지 드래그 방지
                img.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // 이미지 선택 방지
                });
            }
        }
    
        // 메모 전체에 대한 mousedown 이벤트 리스너 추가
        memoWrapper.addEventListener('mousedown', startDraggingMemo);
    }
    

    function enableEditMode(e) {
        const memoContent = e.target;
        memoContent.readOnly = false;
        memoContent.focus();
        
        // 커서를 클릭한 위치로 이동
        const x = e.clientX - memoContent.getBoundingClientRect().left;
        const y = e.clientY - memoContent.getBoundingClientRect().top;
        const position = document.caretPositionFromPoint(x, y);
        if (position) {
            const range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    function disableEditMode(e) {
        e.target.readOnly = true;
        saveMemos();
    }

    function startDraggingCanvas(e) {
        if (e.target === canvas || e.target === canvasContent) {
            isDraggingCanvas = true;
            lastX = e.clientX;
            lastY = e.clientY;
        }
    }

    function dragCanvas(e) {
        if (isDraggingCanvas) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            const currentTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
            canvasContent.style.transform = currentTransform.translate(dx / scale, dy / scale).toString();
            lastX = e.clientX;
            lastY = e.clientY;
        }
    }
    
    function stopDraggingCanvas() {
        isDraggingCanvas = false;
    }
    
    function startDraggingMemo(e) {
        if (isContextMenuOpen) {
            return;
        }
    
        const memoWrapper = e.target.closest('.memo-wrapper');
        if (!memoWrapper) return;
    
        const memoContent = memoWrapper.querySelector('.memo-content');
    
        // 텍스트 영역을 클릭했을 때 편집 모드로 전환
        if (e.target === memoContent) {
            enableEditMode(e);
            return;
        }
    
        // 이미 편집 모드인 경우 드래그하지 않음
        if (memoContent && !memoContent.readOnly) {
            return;
        }
    
        // 리사이즈 핸들이나 메모 아이콘을 클릭한 경우 드래그하지 않음
        if (e.target.closest('.resize-handle') || e.target.closest('.memo-icons')) {
            return;
        }
    
        e.preventDefault();
        activeMemo = memoWrapper;
    
        const canvasRect = canvas.getBoundingClientRect();
        const memoRect = memoWrapper.getBoundingClientRect();
        memoOffsetX = (e.clientX - memoRect.left) / scale;
        memoOffsetY = (e.clientY - memoRect.top) / scale;

        document.addEventListener('mousemove', dragMemo);
        document.addEventListener('mouseup', stopDraggingMemo);
    }

    function dragMemo(e) {
        if (activeMemo) {
            const canvasRect = canvas.getBoundingClientRect();
            const canvasTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
            const x = (e.clientX - canvasRect.left - canvasTransform.e) / scale - memoOffsetX;
            const y = (e.clientY - canvasRect.top - canvasTransform.f) / scale - memoOffsetY;
            activeMemo.style.left = `${x}px`;
            activeMemo.style.top = `${y}px`;
        }
    }

    function stopDraggingMemo() {
        if (activeMemo) {
            document.removeEventListener('mousemove', dragMemo);
            document.removeEventListener('mouseup', stopDraggingMemo);
            saveMemos();
            activeMemo = null;
        }
    }

    function zoom(e) {
        e.preventDefault();
    
        if (e.ctrlKey) {
            return;
        }
        
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(wheel * zoomIntensity);
    
        const boundingRect = canvas.getBoundingClientRect();
        const x = (e.clientX - boundingRect.left) / scale;
        const y = (e.clientY - boundingRect.top) / scale;
    
        const currentTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
        const newScale = currentTransform.a * zoomFactor;
    
        if (newScale > 0.1 && newScale < 10) {
            const scaleDiff = newScale - currentTransform.a;
            currentTransform.a = currentTransform.d = newScale;
            currentTransform.e -= x * scaleDiff;
            currentTransform.f -= y * scaleDiff;
            canvasContent.style.transform = currentTransform.toString();
            scale = newScale;
        }
    }

    function changeColor(element, color) {
        element.closest('.memo-wrapper').querySelector('.memo').style.backgroundColor = color;
        saveMemos();
    }

    
    function handleImageUpload(input) {
        const file = input.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const memoWrapper = input.closest('.memo-wrapper');
                const imageContainer = memoWrapper.querySelector('.image-container');
                const uploadedImage = imageContainer.querySelector('img');
                const memoContent = memoWrapper.querySelector('.memo-content');
                
                uploadedImage.src = e.target.result;
                memoContent.style.display = 'none';
                imageContainer.style.display = 'flex';

                uploadedImage.draggable = false; // 이미지 드래그 방지
                uploadedImage.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // 이미지 선택 방지
                });

                saveMemos();
            };
            reader.readAsDataURL(file);
        }
    }

    // addDragListeners 함수 추가
    function addDragListeners(memoWrapper) {
        memoWrapper.addEventListener('mousedown', startDraggingMemo);
    }

    function deleteMemo(element) {
        element.closest('.memo-wrapper').remove();
        saveMemos();
    }

    function startResizing(e) {
        isResizing = true;
        const memoWrapper = e.target.closest('.memo-wrapper');
        e.preventDefault();
        e.stopPropagation();
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);

        function resize(e) {
            if (isResizing) {
                const canvasRect = canvas.getBoundingClientRect();
                const canvasTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
                const x = (e.clientX - canvasRect.left - canvasTransform.e) / scale;
                const y = (e.clientY - canvasRect.top - canvasTransform.f) / scale;
                const memoRect = memoWrapper.getBoundingClientRect();
                const newWidth = x - (memoRect.left - canvasRect.left - canvasTransform.e) / scale;
                const newHeight = y - (memoRect.top - canvasRect.top - canvasTransform.f) / scale;
                memoWrapper.querySelector('.memo').style.width = `${newWidth}px`;
                memoWrapper.querySelector('.memo').style.height = `${newHeight}px`;
            }
        }

        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            saveMemos();
        }
    }

    function changeBackground(value) {
        switch(value) {
            case 'grid':
                canvasContent.style.backgroundImage = 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)';
                canvasContent.style.backgroundSize = '20px 20px';
                break;
            case 'dot':
                canvasContent.style.backgroundImage = 'radial-gradient(circle, #000 1px, transparent 1px)';
                canvasContent.style.backgroundSize = '20px 20px';
                break;
            case 'legal':
                canvasContent.style.backgroundImage = 'linear-gradient(#000 1px, transparent 1px)';
                canvasContent.style.backgroundSize = '100% 33.33px';
                break;
            default:
                canvasContent.style.backgroundImage = 'none';
        }
        saveCanvasSettings();
    }

    function toggleMenu() {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    function setCanvasSize(size) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');

        switch (size) {
            case 'A3':
                widthInput.value = 3508;
                heightInput.value = 4961;
                break;
            case 'A4':
                widthInput.value = 2480;
                heightInput.value = 3508;
                break;
            case 'A5':
                widthInput.value = 1748;
                heightInput.value = 2480;
                break;
            case 'B4':
                widthInput.value = 2953;
                heightInput.value = 4169;
                break;
            case 'Letter':
                widthInput.value = 2550;
                heightInput.value = 3300;
                break;
            default:
                return; // 'Custom' 선택 시 아무 작업도 하지 않음
        }

        resizeCanvas();
    }

    function setCanvasOrientation(orientation) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        let width = parseInt(widthInput.value);
        let height = parseInt(heightInput.value);

        if (orientation === 'landscape' && height > width) {
            // 가로모드로 변경: 폭과 높이 교환
            widthInput.value = height;
            heightInput.value = width;
        } else if (orientation === 'portrait' && width > height) {
            // 세로모드로 변경: 폭과 높이 교환
            widthInput.value = height;
            heightInput.value = width;
        }

        resizeCanvas();
    }


    function resizeCanvas() {
        const width = document.getElementById('canvas-width').value;
        const height = document.getElementById('canvas-height').value;
        canvasContent.style.width = `${width}px`;
        canvasContent.style.height = `${height}px`;
        saveCanvasSettings();
    }

    // 데이터 압축 및 Base64 인코딩
    function compressAndEncode(data) {
        const jsonString = JSON.stringify(data);
        const compressed = pako.deflate(jsonString); // 기본적으로 Uint8Array 반환
        // Uint8Array를 문자열로 변환 후 Base64 인코딩
        const binaryString = Array.from(compressed, byte => String.fromCharCode(byte)).join('');
        return btoa(binaryString);
    }

    // Base64 디코딩 및 압축 해제
    function decodeAndDecompress(encodedData) {
        const binaryString = atob(encodedData);
        const charCodes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            charCodes[i] = binaryString.charCodeAt(i);
        }
        const decompressed = pako.inflate(charCodes, { to: 'string' });
        return JSON.parse(decompressed);
    }

    function saveMemos() {
        const memos = Array.from(document.querySelectorAll('.memo-wrapper')).map(memo => {
            const memoContent = memo.querySelector('.memo-content');
            const imageContainer = memo.querySelector('.image-container');
            const memoElement = memo.querySelector('.memo');
            
            return {
                id: memo.id.replace('memo-', ''),
                left: memo.style.left,
                top: memo.style.top,
                width: memoElement.style.width,
                height: memoElement.style.height,
                backgroundColor: memoElement.style.backgroundColor,
                content: memoContent.value,
                imageSrc: imageContainer.style.display !== 'none' ? imageContainer.querySelector('img').src : '',
                zIndex: memo.style.zIndex || '1'
            };
        });
    
        try {
            localStorage.setItem('memos', JSON.stringify(memos));
        } catch (error) {
            console.error('Failed to save memos:', error);
            alert('Failed to save memos. Local storage might be full.');
        }
    }
    




    function saveCanvasSettings() {
        const settings = {
            background: document.getElementById('background-selector').value,
            width: canvasContent.style.width,
            height: canvasContent.style.height,
            size: document.getElementById('canvas-size-selector').value,
            orientation: document.getElementById('canvas-orientation-selector').value
        };
        localStorage.setItem('canvasSettings', JSON.stringify(settings));
    }


    function loadMemos() {
        try {
            const savedMemos = JSON.parse(localStorage.getItem('memos'));
            if (savedMemos && Array.isArray(savedMemos)) {
                // 기존 메모 모두 제거
                const existingMemos = document.querySelectorAll('.memo-wrapper');
                existingMemos.forEach(memo => memo.remove());
    
                // 저장된 메모 로드
                savedMemos.forEach(memoData => {
                    const memoWrapper = createMemo(parseFloat(memoData.left), parseFloat(memoData.top), memoData);
                    addDragListeners(memoWrapper); // 여기에 드래그 리스너 추가
                });
            }
        } catch (error) {
            console.error('Failed to load memos:', error);
            alert('Failed to load memos. Data might be corrupted.');
        }
    }

    function exportMemos() {
        const memos = Array.from(document.querySelectorAll('.memo-wrapper')).map(memo => {
            const memoContent = memo.querySelector('.memo-content');
            const imageContainer = memo.querySelector('.image-container');
            let imageSrc = "";

            if (imageContainer && imageContainer.querySelector('img').src) {
                // 이미지가 있을 때만 src 값을 저장
                const imgSrc = imageContainer.querySelector('img').src;
                imageSrc = imgSrc.startsWith("data:image/") ? imgSrc : "";
            }

            return {
                left: memo.style.left,
                top: memo.style.top,
                width: memo.querySelector('.memo').style.width,
                height: memo.querySelector('.memo').style.height,
                backgroundColor: memo.querySelector('.memo').style.backgroundColor,
                content: memoContent.value,
                imageSrc: imageSrc, // 이미지가 없으면 빈 문자열을 저장
                zIndex: memo.style.zIndex // z-index 값 저장 (기본값 1)
            };
        });

        const encodedData = compressAndEncode(memos);
        const blob = new Blob([encodedData], { type: 'text/plain' });

        // 파일 이름을 사용자로부터 입력받음
        const now = new Date();
        const formattedDate = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
        const tempName = `MyMemo_${formattedDate}`;
        const fileName = prompt("Enter the file name for your export:", tempName);
        if (fileName) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName + '.memo'; // 사용자 정의 파일 이름
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert("File export canceled.");
        }
    }

    function importMemos(event) {
        const file = event.target.files && event.target.files[0];
        
        if (!file) {
            console.error("No file selected or file input is invalid.");
            alert("Please select a valid .memo file to import.");
            return;
        }
    
        const reader = new FileReader();
        reader.onload = function(e) {
            const encodedData = e.target.result;
            try {
                const savedMemos = decodeAndDecompress(encodedData);
                localStorage.setItem('memos', JSON.stringify(savedMemos));
                loadMemos();
                alert('Memo data has been imported successfully.');
            } catch (error) {
                console.error("Failed to import memo data:", error);
                alert('Failed to import memo data. Please check the input data.');
            }
        };
        reader.readAsText(file);
    }
    
    function loadCanvasSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('canvasSettings'));
        if (savedSettings) {
            document.getElementById('background-selector').value = savedSettings.background;
            changeBackground(savedSettings.background);
            canvasContent.style.width = savedSettings.width || '100%';
            canvasContent.style.height = savedSettings.height || '100%';
            document.getElementById('canvas-width').value = parseInt(savedSettings.width) || canvasContent.clientWidth;
            document.getElementById('canvas-height').value = parseInt(savedSettings.height) || canvasContent.clientHeight;
            document.getElementById('canvas-size-selector').value = savedSettings.size || 'custom';
            document.getElementById('canvas-orientation-selector').value = savedSettings.orientation || 'portrait';
        } else {
            // 기본 설정
            canvasContent.style.width = '100%';
            canvasContent.style.height = '100%';
            document.getElementById('canvas-width').value = canvasContent.clientWidth;
            document.getElementById('canvas-height').value = canvasContent.clientHeight;
            document.getElementById('canvas-size-selector').value = 'custom';
            document.getElementById('background-selector').value = 'none';
            document.getElementById('canvas-orientation-selector').value = 'portrait';
        }
        saveCanvasSettings(); // 초기 설정을 저장
    }


    window.addEventListener('load', () => {
        loadMemos();
        loadCanvasSettings();
    });

    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('memo-content')) {
            saveMemos();
        }
    });

    // 컨텍스트 메뉴를 숨기는 함수
    function hideContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'none';
        isContextMenuOpen = false;
        activeMemo = null;
    }

    // 우클릭으로 컨텍스트 메뉴를 표시하는 함수
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();

        const memoWrapper = e.target.closest('.memo-wrapper');
        if (memoWrapper) {
            // 드래그 모드를 해제
            stopDragging();
            
            activeMemo = memoWrapper;

            const contextMenu = document.getElementById('context-menu');
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';
            
            isContextMenuOpen = true; // 컨텍스트 메뉴가 열려있음을 표시
        } else {
            hideContextMenu();
        }
    });


    // Bring to Front 기능 구현
    document.getElementById('bring-to-front').addEventListener('click', function() {
        if (activeMemo) {
            activeMemo.style.zIndex = ++highestZIndex;
            saveMemos(); // z-order 변경 후 즉시 저장
            hideContextMenu();
        }
    });

    // Send to Back 기능 구현
    document.getElementById('send-to-back').addEventListener('click', function() {
        if (activeMemo) {
            activeMemo.style.zIndex = --lowestZIndex;
            saveMemos(); // z-order 변경 후 즉시 저장
            hideContextMenu();
        }
    });

    // 클릭 시 컨텍스트 메뉴를 숨기도록 설정
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#context-menu')) {
            hideContextMenu();
            isContextMenuOpen = false; // 컨텍스트 메뉴가 닫혔음을 표시
            activeMemo = null;
        }
    });


    // 모든 메모 초기화 함수
    function resetAllMemos() {
        const confirmed = confirm("Are you sure you want to delete all memos?");
        if (confirmed) {
            // 화면에서 모든 메모 삭제
            const memoWrappers = document.querySelectorAll('.memo-wrapper');
            memoWrappers.forEach(memo => memo.remove());

            // 로컬 스토리지에서 메모 데이터 삭제
            localStorage.removeItem('memos');
        }
    }
});