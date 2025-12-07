// Three.js değişkenleri
let scene, camera, renderer, objModel, controls;
let isRotating = true;
let currentScale = 1;
let clock = new THREE.Clock();

// Yükleme durumu
let modelLoaded = false;

function init() {
    try {
        // Sahneyi oluştur
        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x000022, 10, 50);
        
        // Kamerayı ayarla
        camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 3, 10);
        
        // Renderer oluştur
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);
        
        // Işıklar
        setupLights();
        
        // Zemin
        createGround();
        
        // Skybox
        createSkybox();
        
        // OBJ modelini yükle
        loadOBJModel();
        
        // Dokunmatik kontroller
        setupTouchControls();
        
        // Animasyon döngüsü
        animate();
        
        // Pencere boyutu değişince
        window.addEventListener('resize', onWindowResize);
        
        // Yükleme gizle
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 1000);
        
    } catch (error) {
        console.error('Başlatma hatası:', error);
        document.getElementById('loading').innerHTML = 
            'Hata oluştu!<br>Konsolu kontrol edin.';
    }
}

function setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Spotlight
    const spotLight = new THREE.SpotLight(0xffffff, 0.5);
    spotLight.position.set(0, 15, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.1;
    spotLight.decay = 2;
    spotLight.distance = 50;
    spotLight.castShadow = true;
    scene.add(spotLight);
    
    // SpotLight helper
    // scene.add(new THREE.SpotLightHelper(spotLight));
}

function createGround() {
    const groundGeometry = new THREE.CircleGeometry(30, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5a27,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createSkybox() {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x87CEEB,
        side: THREE.BackSide
    });
    const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skybox);
}

function loadOBJModel() {
    // MTL ve OBJ yükleyicileri
    const mtlLoader = new THREE.MTLLoader();
    const objLoader = new THREE.OBJLoader();
    
    // MTL dosyasını yükle
    mtlLoader.setPath('models/');
    mtlLoader.load(
        'O3ZHYWWYBQ64BGXI7ZKDI0FWX.mtl',
        function(materials) {
            materials.preload();
            
            // Materyalleri OBJ loader'a ata
            objLoader.setMaterials(materials);
            
            // OBJ dosyasını yükle
            objLoader.setPath('models/');
            objLoader.load(
                'O3ZHYWWYBQ64BGXI7ZKDI0FWX.obj',
                function(object) {
                    objModel = object;
                    modelLoaded = true;
                    
                    // Modeli sahneye ekle
                    scene.add(objModel);
                    
                    // Gölge ve özellikleri ayarla
                    objModel.traverse(function(child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Materyal özelliklerini iyileştir
                            if (child.material) {
                                child.material.roughness = 0.5;
                                child.material.metalness = 0.2;
                            }
                        }
                    });
                    
                    // Modeli merkezle ve ölçeklendir
                    const box = new THREE.Box3().setFromObject(objModel);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    // Modeli ortalama
                    objModel.position.sub(center);
                    
                    // Ölçeklendir (model boyutuna göre)
                    const maxSize = Math.max(size.x, size.y, size.z);
                    const targetSize = 5;
                    const scale = targetSize / maxSize;
                    
                    currentScale = scale;
                    objModel.scale.setScalar(scale);
                    
                    // Modeli yukarı kaldır
                    objModel.position.y = size.y * scale / 2;
                    
                    // Bilgi metnini güncelle
                    updateInfoText();
                    
                    console.log('Model başarıyla yüklendi!');
                    console.log('Boyut:', size);
                    console.log('Ölçek:', scale);
                    
                },
                // İlerleme fonksiyonu
                function(xhr) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    document.getElementById('loading').innerHTML = 
                        `Model yükleniyor: ${percent}%`;
                },
                // Hata fonksiyonu
                function(error) {
                    console.error('OBJ yükleme hatası:', error);
                    document.getElementById('loading').innerHTML = 
                        'Model yüklenemedi!<br>Dosya yolunu kontrol edin.';
                    
                    // Test küpü göster
                    createTestModel();
                }
            );
        },
        // MTL yükleme ilerlemesi
        function(xhr) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            document.getElementById('loading').innerHTML = 
                `Materyaller yükleniyor: ${percent}%`;
        },
        // MTL yükleme hatası
        function(error) {
            console.warn('MTL dosyası yüklenemedi, materyalsiz devam ediliyor:', error);
            
            // MTL yoksa direkt OBJ yükle
            loadOBJWithoutMTL();
        }
    );
}

function loadOBJWithoutMTL() {
    const objLoader = new THREE.OBJLoader();
    
    objLoader.setPath('models/');
    objLoader.load(
        'O3ZHYWWYBQ64BGXI7ZKDI0FWX.obj',
        function(object) {
            objModel = object;
            modelLoaded = true;
            
            // Varsayılan güzel bir materyal uygula
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x4a90e2,
                roughness: 0.3,
                metalness: 0.7,
                wireframe: false
            });
            
            objModel.traverse(function(child) {
                if (child.isMesh) {
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            scene.add(objModel);
            
            // Modeli merkezle
            const box = new THREE.Box3().setFromObject(objModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            objModel.position.sub(center);
            objModel.position.y = size.y / 2;
            
            // Ölçeklendir
            const maxSize = Math.max(size.x, size.y, size.z);
            const targetSize = 5;
            currentScale = targetSize / maxSize;
            objModel.scale.setScalar(currentScale);
            
            updateInfoText();
            console.log('OBJ materyalsiz yüklendi');
        },
        null,
        function(error) {
            console.error('OBJ yükleme hatası:', error);
            createTestModel();
        }
    );
}

function createTestModel() {
    // Geometri grubu oluştur
    const group = new THREE.Group();
    
    // Ana küre
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff6b6b,
        roughness: 0.3,
        metalness: 0.7
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.y = 1.5;
    sphere.castShadow = true;
    group.add(sphere);
    
    // Silindir
    const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
    const cylinderMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4ecdc4 
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.castShadow = true;
    group.add(cylinder);
    
    // Taban
    const boxGeometry = new THREE.BoxGeometry(3, 0.5, 3);
    const boxMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x45b7d1 
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = -1;
    box.receiveShadow = true;
    group.add(box);
    
    objModel = group;
    scene.add(objModel);
    modelLoaded = true;
    
    document.getElementById('info').innerHTML = 
        'Test Modeli Yüklendi<br>' +
        'OBJ dosyanızı models/ klasörüne koyun';
}

function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;
    
    renderer.domElement.addEventListener('touchstart', function(event) {
        event.preventDefault();
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        isDragging = true;
    });
    
    renderer.domElement.addEventListener('touchmove', function(event) {
        event.preventDefault();
        if (!objModel || !isDragging) return;
        
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
        
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        
        // Modeli döndür
        objModel.rotation.y += deltaX * 0.01;
        objModel.rotation.x += deltaY * 0.005;
        
        touchStartX = touchX;
        touchStartY = touchY;
    });
    
    renderer.domElement.addEventListener('touchend', function() {
        isDragging = false;
    });
}

// Kontrol fonksiyonları
function toggleRotate() {
    if (!modelLoaded) return;
    isRotating = !isRotating;
    updateInfoText();
}

function scaleUp() {
    if (!modelLoaded) return;
    currentScale *= 1.2;
    objModel.scale.setScalar(currentScale);
    updateInfoText();
}

function scaleDown() {
    if (!modelLoaded) return;
    currentScale *= 0.8;
    objModel.scale.setScalar(Math.max(0.1, currentScale));
    updateInfoText();
}

function resetModel() {
    if (!modelLoaded) return;
    objModel.rotation.set(0, 0, 0);
    currentScale = 1;
    objModel.scale.setScalar(currentScale);
    isRotating = true;
    updateInfoText();
}

function updateInfoText() {
    if (!modelLoaded) return;
    
    const rotationStatus = isRotating ? 'AÇIK' : 'KAPALI';
    const scalePercent = Math.round(currentScale * 100);
    
    document.getElementById('info').innerHTML = 
        `3D Model: O3ZHYWWYBQ64BGXI7ZKDI0FWX<br>` +
        `Oto Döndürme: <b>${rotationStatus}</b><br>` +
        `Ölçek: <b>${scalePercent}%</b><br>` +
        `Ekrana dokunup sürükleyerek döndürebilirsiniz`;
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Model otomatik döndürme
    if (objModel && isRotating) {
        objModel.rotation.y += 0.5 * delta;
    }
    
    // Kamera hafif hareketi
    const time = Date.now() * 0.001;
    camera.position.x = Math.sin(time * 0.5) * 2;
    camera.position.y = 3 + Math.sin(time * 0.7) * 0.5;
    camera.lookAt(0, 1, 0);
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Sayfa yüklendiğinde başlat
window.onload = init;

// Hata yakalama
window.addEventListener('error', function(e) {
    console.error('Global hata:', e.error);
    document.getElementById('info').innerHTML = 
        'Bir hata oluştu!<br>Konsolu kontrol edin.';
});
