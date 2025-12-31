# Draw2Gather - VDS Deployment Rehberi 🚀

## 1. Sunucuya Bağlanma

```bash
ssh root@SUNUCU_IP_ADRESI
```

---

## 2. Node.js Kurulumu (Ubuntu/Debian)

```bash
# Sistem güncellemesi
apt update && apt upgrade -y

# Node.js 20.x kurulumu
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Kurulumu doğrula
node --version
npm --version
```

### CentOS/RHEL için:
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs
```

---

## 3. PM2 Kurulumu (Process Manager)

PM2, uygulamanın sürekli çalışmasını ve sunucu yeniden başlatıldığında otomatik başlamasını sağlar.

```bash
npm install -g pm2
```

---

## 4. Proje Klasörü Oluşturma

```bash
# Uygulama dizini oluştur
mkdir -p /var/www/draw2gather
cd /var/www/draw2gather
```

---

## 5. Dosyaları Sunucuya Yükleme

### Yerel bilgisayarınızdan (PowerShell/CMD):

```powershell
# SCP ile dosyaları kopyala
scp -r C:\Users\yasin\Desktop\Draw2Gather\* root@SUNUCU_IP_ADRESI:/var/www/draw2gather/
```

### Veya FileZilla/WinSCP ile:
1. SFTP bağlantısı kur
2. Tüm dosyaları `/var/www/draw2gather/` klasörüne yükle

---

## 6. Bağımlılıkları Yükleme

Sunucuda:

```bash
cd /var/www/draw2gather
npm install --production
```

---

## 7. Uygulamayı Başlatma

### Test için (terminalde görünür):
```bash
node server.js
```

### PM2 ile (arka planda, kalıcı):
```bash
pm2 start server.js --name "draw2gather"

# Otomatik başlatma için
pm2 startup
pm2 save
```

---

## 8. Firewall Ayarları

Port 3131'i aç:

### UFW (Ubuntu):
```bash
ufw allow 3131
ufw reload
```

### firewalld (CentOS):
```bash
firewall-cmd --permanent --add-port=3131/tcp
firewall-cmd --reload
```

### iptables:
```bash
iptables -A INPUT -p tcp --dport 3131 -j ACCEPT
```

---

## 9. Uygulamaya Erişim

Tarayıcıda aç:
```
http://SUNUCU_IP_ADRESI:3131
```

---

## Faydalı PM2 Komutları

| Komut | Açıklama |
|-------|----------|
| `pm2 list` | Çalışan uygulamaları listele |
| `pm2 logs draw2gather` | Logları görüntüle |
| `pm2 restart draw2gather` | Uygulamayı yeniden başlat |
| `pm2 stop draw2gather` | Uygulamayı durdur |
| `pm2 delete draw2gather` | Uygulamayı PM2'den kaldır |
| `pm2 monit` | Canlı monitoring |

---

## Sorun Giderme

### Port kullanımda hatası:
```bash
# Portu kullanan işlemi bul
lsof -i :3131
# veya
netstat -tulpn | grep 3131
```

### Sunucu logları:
```bash
pm2 logs draw2gather --lines 50
```

### Node.js sürümü sorunu:
```bash
node --version  # 18+ olmalı
```

---

## Özet Komutlar (Hızlı Kurulum)

```bash
# Tek seferde çalıştır (Ubuntu/Debian)
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
mkdir -p /var/www/draw2gather
cd /var/www/draw2gather
# ... dosyaları yükle ...
npm install --production
pm2 start server.js --name "draw2gather"
pm2 startup
pm2 save
ufw allow 3131
```

🎨 **Hazır!** `http://SUNUCU_IP:3131` adresinden erişebilirsiniz!
