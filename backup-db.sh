#!/bin/bash
BACKUP_DIR="/opt/trackjobs/backups"
MYSQL_USER="trackjobs_user"
MYSQL_PASSWORD="secure_password_here"
DB_NAME="trackjobs"
DATE=$(date +"%Y%m%d_%H%M%S")

mkdir -p $BACKUP_DIR
mysqldump -u$MYSQL_USER -p$MYSQL_PASSWORD $DB_NAME > $BACKUP_DIR/trackjobs_$DATE.sql

# Keep only the last 10 backups
ls -t $BACKUP_DIR/trackjobs_*.sql | tail -n +11 | xargs -r rm
