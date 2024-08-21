
document.addEventListener('DOMContentLoaded', (event) => {

    // Canvas 관련 기능
    document.getElementById('background-selector').addEventListener('change', function() {
        changeBackground(this.value);
    });

    document.getElementById('canvas-size-selector').addEventListener('change', function() {
        setCanvasSize(this.value);
    });

    document.getElementById('canvas-orientation-selector').addEventListener('change', function() {
        setCanvasOrientation(this.value);
    });

    document.getElementById('applySizeButton').addEventListener('click', function() {
        resizeCanvas();
    });

    // Export / Import 관련 기능
    document.getElementById('exportButton').addEventListener('click', exportMemos);

    document.getElementById('importButton').addEventListener('click', function() {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', importMemos);
    
    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const menuIcon = document.getElementById('menu-icon');
    const menu = document.getElementById('menu');

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

    // Canvas panning
    canvas.addEventListener('mousedown', function(e) {
        if (e.button === 0) { // 왼쪽 마우스 버튼에 한정
            startDraggingCanvas(e);
        }
    });
    canvas.addEventListener('mousedown', startDraggingCanvas);
    canvas.addEventListener('mousemove', drag);
    canvas.addEventListener('mouseup', stopDragging);
    canvas.addEventListener('mouseleave', stopDragging);

    // Zooming
    canvas.addEventListener('wheel', zoom);

    // Double click to create memo (using event delegation)
    canvasContent.addEventListener('dblclick', handleDoubleClick);

    // Menu toggle
    menuIcon.addEventListener('click', toggleMenu);

    function handleDoubleClick(e) {
        if (e.target === canvasContent) {
            createMemo(e);
        }
    }

    function createMemo(e) {
        const canvasRect = canvas.getBoundingClientRect();
        const canvasTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
        const x = (e.clientX - canvasRect.left - canvasTransform.e) / scale;
        const y = (e.clientY - canvasRect.top - canvasTransform.f) / scale;

        const memoWrapper = document.createElement('div');
        memoWrapper.className = 'memo-wrapper';
        memoWrapper.style.left = `${x}px`;
        memoWrapper.style.top = `${y}px`;

        const memoId = Date.now();
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
            <div class="memo">
                <textarea class="memo-content" readonly></textarea>
                <div class="image-container">
                    <img src="" alt="Uploaded image">
                </div>
            </div>
            <div class="resize-handle">⤡</div>
        `;

        canvasContent.appendChild(memoWrapper);

        const memo = memoWrapper.querySelector('.memo');
        memo.addEventListener('mousedown', function(e) {
            if (e.button === 0) { // 왼쪽 마우스 버튼 클릭일 때만
                startDraggingMemo(e);
            }
        });

        const resizeHandle = memoWrapper.querySelector('.resize-handle');
        resizeHandle.addEventListener('mousedown', startResizing);
        
        const memoContent = memoWrapper.querySelector('.memo-content');
        memoContent.addEventListener('dblclick', enableEditMode);
        memoContent.addEventListener('blur', disableEditMode);

        saveMemos();
    }

    function enableEditMode(e) {
        e.target.readOnly = false;
        e.target.focus();
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

    function startDraggingMemo(e) {
        // 우클릭 중에는 드래그 시작을 무시
        if (isContextMenuOpen) {
            return;
        }

        const memoWrapper = e.target.closest('.memo-wrapper');
        const memoContent = memoWrapper.querySelector('.memo-content');

        // 텍스트가 편집 모드인지 확인
        if (memoContent && !memoContent.readOnly) {
            // 편집 모드라면 이동하지 않도록 함수 종료
            return;
        }

        if (memoWrapper && e.target !== memoWrapper.querySelector('.resize-handle') && 
            !e.target.closest('.memo-icons')) {
            activeMemo = memoWrapper;
            const canvasRect = canvas.getBoundingClientRect();
            const memoRect = memoWrapper.getBoundingClientRect();
            memoOffsetX = (e.clientX - memoRect.left) / scale;
            memoOffsetY = (e.clientY - memoRect.top) / scale;
            e.preventDefault();
        }
    }


    function drag(e) {
        if (isDraggingCanvas) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            const currentTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
            canvasContent.style.transform = currentTransform.translate(dx / scale, dy / scale).toString();
            lastX = e.clientX;
            lastY = e.clientY;
        } else if (activeMemo && !isContextMenuOpen) {
            const canvasRect = canvas.getBoundingClientRect();
            const canvasTransform = new DOMMatrix(getComputedStyle(canvasContent).transform);
            const x = (e.clientX - canvasRect.left - canvasTransform.e) / scale - memoOffsetX;
            const y = (e.clientY - canvasRect.top - canvasTransform.f) / scale - memoOffsetY;
            activeMemo.style.left = `${x}px`;
            activeMemo.style.top = `${y}px`;
        }
    }

    function stopDragging() {
        isDraggingCanvas = false;
        if (activeMemo && !isContextMenuOpen) {
            saveMemos();
            activeMemo = null;
        }
    }

    function zoom(e) {
        e.preventDefault();
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
                memoContent.value = '';

                saveMemos();
            };
            reader.readAsDataURL(file);
        }
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

        // 데이터 로컬 저장 방식
        localStorage.setItem('memos', JSON.stringify(memos));

        // 객체를 JSON 문자열로 변환하고 URL 인코딩
        // const memoData = encodeURIComponent(JSON.stringify(memos));
        // window.location.hash = memoData;

        // 객체를 JSON 문자열로 변환하고 URL 인코딩 + 압축
        // const encodedData = compressAndEncode(memos);
        // window.location.hash = encodedData;
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
        // 데이터 로컬 로드 방식
        const savedMemos = JSON.parse(localStorage.getItem('memos'));

        //const memoData = window.location.hash.substring(1); // 해시(#) 부분의 데이터를 가져옴
        //if (memoData) {
        //    // const savedMemos = JSON.parse(decodeURIComponent(memoData)); // 압축 X
        //    const savedMemos = decodeAndDecompress(memoData);

            if (savedMemos) {
                savedMemos.forEach(memoData => {
                    const memoWrapper = document.createElement('div');
                    memoWrapper.className = 'memo-wrapper';
                    memoWrapper.style.left = memoData.left;
                    memoWrapper.style.top = memoData.top;
                    memoWrapper.style.zIndex = memoData.zIndex; // z-index 값 로드

                    const memoId = Date.now();
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
                        <div class="memo" style="width: ${memoData.width}; height: ${memoData.height}; background-color: ${memoData.backgroundColor || '#ffff99'};">
                            <textarea class="memo-content" readonly>${memoData.content}</textarea>
                            <div class="image-container" style="display: ${memoData.imageSrc ? 'flex' : 'none'}">
                                <img src="${memoData.imageSrc}" alt="Uploaded image">
                            </div>
                        </div>
                        <div class="resize-handle">⤡</div>
                    `;
                    canvasContent.appendChild(memoWrapper);

                    // 이미지가 있는 경우 텍스트 필드를 숨김
                    const memoContent = memoWrapper.querySelector('.memo-content');
                    const imageContainer = memoWrapper.querySelector('.image-container');
                    const uploadedImage = imageContainer.querySelector('img');

                    if (memoData.imageSrc) {
                        uploadedImage.src = memoData.imageSrc; // 이미지 소스 설정
                        memoContent.style.display = 'none'; // 텍스트 숨기기
                        imageContainer.style.display = 'flex'; // 이미지 컨테이너 표시
                    } else {
                        imageContainer.style.display = 'none'; // 이미지가 없으면 숨기기
                        uploadedImage.src = ""; // 이미지 소스 초기화
                        memoContent.style.display = 'block'; // 텍스트 표시
                    }

                    // 마우스 이벤트 추가
                    memoWrapper.addEventListener('mouseenter', () => {
                        memoWrapper.querySelector('.memo-icons').style.display = 'flex';
                        memoWrapper.querySelector('.resize-handle').style.display = 'flex';
                    });

                    memoWrapper.addEventListener('mouseleave', () => {
                        memoWrapper.querySelector('.memo-icons').style.display = 'none';
                        memoWrapper.querySelector('.resize-handle').style.display = 'none';
                    });

                    // 기존 이벤트 리스너 추가
                    memoWrapper.querySelector('.memo').addEventListener('mousedown', function(e) {
                        if (e.button === 0) { // 왼쪽 마우스 버튼 클릭일 때만
                            startDraggingMemo(e);
                        }
                    });
                    memoWrapper.querySelector('.resize-handle').addEventListener('mousedown', startResizing);
                    memoContent.addEventListener('dblclick', enableEditMode);
                    memoContent.addEventListener('blur', disableEditMode);
                });
            }
        //}
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

    function importMemos() {
        const file = event.target.files[0];
        if (file) {
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
});