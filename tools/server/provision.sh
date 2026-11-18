#!/usr/bin/env bash
# Prepara a VM (Ubuntu 24.04 ARM, Oracle Always Free) para o Estrela6.
# Rodar UMA vez:  sudo bash /tmp/provision.sh
# Espera em /tmp: Caddyfile, origin.pem e origin.key (certificado de origem da Cloudflare).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode com sudo"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
APP=/var/www/estrela6
PHPV=8.4

echo "== pacotes"
apt-get update -qq
apt-get install -y -qq software-properties-common curl unzip git acl fail2ban unattended-upgrades supervisor mysql-server ffmpeg
add-apt-repository -y ppa:ondrej/php >/dev/null
apt-get update -qq
apt-get install -y -qq php$PHPV-{fpm,cli,mysql,mbstring,xml,curl,zip,gd,intl,bcmath,exif,opcache,readline,sqlite3}
curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer >/dev/null
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq && apt-get install -y -qq caddy

echo "== atualizações automáticas de segurança"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== PHP"
sed -i 's/^;\?opcache.enable=.*/opcache.enable=1/; s/^;\?expose_php.*/expose_php = Off/; s/^upload_max_filesize.*/upload_max_filesize = 12M/; s/^post_max_size.*/post_max_size = 16M/' /etc/php/$PHPV/fpm/php.ini
sed -i 's/^pm.max_children.*/pm.max_children = 20/' /etc/php/$PHPV/fpm/pool.d/www.conf

echo "== usuário deploy"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG www-data deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
[ -f /home/deploy/.ssh/id_deploy ] || ssh-keygen -t ed25519 -N "" -C "github-deploy" -f /home/deploy/.ssh/id_deploy >/dev/null
cat /home/deploy/.ssh/id_deploy.pub >> /home/deploy/.ssh/authorized_keys
sort -u -o /home/deploy/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/*
echo "deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload php$PHPV-fpm" > /etc/sudoers.d/deploy && chmod 440 /etc/sudoers.d/deploy

echo "== pastas"
for env in production staging; do
  mkdir -p $APP/$env/{releases,shared/storage/{app/public,framework/{cache,sessions,views},logs}}
  touch $APP/$env/shared/.env
done
chown -R deploy:www-data $APP
chmod -R 775 $APP/*/shared/storage
chmod 640 $APP/*/shared/.env

echo "== MySQL"
gen() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-24; }
PROD_PW=$(gen); STG_PW=$(gen)
mysql <<SQL
CREATE DATABASE IF NOT EXISTS estrela6 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS estrela6_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'estrela6'@'localhost' IDENTIFIED BY '$PROD_PW';
CREATE USER IF NOT EXISTS 'estrela6_stg'@'localhost' IDENTIFIED BY '$STG_PW';
GRANT ALL ON estrela6.* TO 'estrela6'@'localhost';
GRANT ALL ON estrela6_staging.* TO 'estrela6_stg'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "== fila e agendador"
for env in production staging; do
cat > /etc/supervisor/conf.d/estrela6-$env.conf <<CONF
[program:estrela6-$env-queue]
command=php $APP/$env/current/artisan queue:work --sleep=3 --tries=3 --max-time=3600
user=deploy
autostart=true
autorestart=true
stopwaitsecs=3600
stdout_logfile=$APP/$env/shared/storage/logs/queue.log
CONF
done
cat > /etc/cron.d/estrela6 <<CRON
* * * * * deploy cd $APP/production/current && php artisan schedule:run >> /dev/null 2>&1
* * * * * deploy cd $APP/staging/current && php artisan schedule:run >> /dev/null 2>&1
CRON
supervisorctl reread >/dev/null && supervisorctl update >/dev/null || true

echo "== Caddy + certificado de origem da Cloudflare"
mkdir -p /etc/caddy/certs
cp /tmp/origin.pem /tmp/origin.key /etc/caddy/certs/ && chown -R caddy:caddy /etc/caddy/certs && chmod 600 /etc/caddy/certs/origin.key
cp /tmp/Caddyfile /etc/caddy/Caddyfile
STG_USER=equipe; STG_PASS=$(gen)
STG_HASH=$(caddy hash-password --plaintext "$STG_PASS")
sed -i "s|__STAGING_HASH__|$STG_HASH|" /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "== firewall: 22 aberto, 80/443 só para a Cloudflare"
# As imagens Ubuntu da Oracle já vêm com iptables bloqueando tudo menos a 22.
apt-get install -y -qq iptables-persistent
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4); do
  iptables -C INPUT -p tcp -m multiport --dports 80,443 -s "$ip" -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 5 -p tcp -m multiport --dports 80,443 -s "$ip" -j ACCEPT
done
netfilter-persistent save >/dev/null

echo "== fail2ban (ssh)"
systemctl enable --now fail2ban >/dev/null

systemctl restart php$PHPV-fpm
cat <<OUT

================ PRONTO ================
Guarde agora no gerenciador de senhas:
  MySQL produção : usuário estrela6      senha $PROD_PW
  MySQL staging  : usuário estrela6_stg  senha $STG_PW
  Staging (acesso): $STG_USER / $STG_PASS   → secret STAGING_BASIC_AUTH = $STG_USER:$STG_PASS

Secret DEPLOY_SSH_KEY (chave privada):
  sudo cat /home/deploy/.ssh/id_deploy

Próximo passo: preencher $APP/production/shared/.env e $APP/staging/shared/.env
OUT
