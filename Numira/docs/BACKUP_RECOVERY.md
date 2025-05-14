# Backup and Recovery System

This document provides an overview of the backup and recovery system implemented in the Numira application. It explains how the system works, how to configure it, and how to perform backup and recovery operations.

## Overview

The backup and recovery system provides the following features:

- Automated database backups
- File system backups for user uploads and other important files
- Configurable backup retention policies
- Backup compression to save storage space
- Optional backup encryption for sensitive data
- Remote storage support (local, S3, GCS)
- Backup verification to ensure backups are valid
- Easy-to-use recovery tools
- HIPAA-compliance ready architecture
- Tamper-evident audit logging
- Access control mechanisms

## Architecture

The backup system consists of the following components:

1. **BackupService**: A centralized service that handles all backup-related functionality.
2. **Cron Jobs**: Scheduled tasks that run the backup process automatically.
3. **Restore Script**: A command-line tool for restoring backups when needed.

## Configuration

The backup system can be configured through environment variables or by modifying the settings in the `backupService.js` file.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKUP_ENCRYPTION_KEY` | Key used for backup encryption (hex format) | None |
| `BACKUP_ENCRYPTION_IV` | Initialization vector for encryption (hex format) | Random |
| `BACKUP_S3_BUCKET` | S3 bucket name for remote storage | None |
| `BACKUP_S3_REGION` | AWS region for S3 bucket | us-east-1 |
| `BACKUP_S3_ACCESS_KEY` | AWS access key for S3 | None |
| `BACKUP_S3_SECRET_KEY` | AWS secret key for S3 | None |
| `BACKUP_GCS_BUCKET` | Google Cloud Storage bucket name | None |
| `BACKUP_GCS_KEY_FILE` | Path to GCS key file | None |

### Backup Directories

Backups are stored in the following directories:

- Database backups: `backups/database/`
- File backups: `backups/files/`

## Backup Process

### Automated Backups

The system is configured to run backups automatically using cron jobs:

- Daily database backup at 2 AM
- Weekly cleanup of old backups at 3 AM on Sunday

### Manual Backups

You can also run backups manually using the following command:

```bash
node cron/backup.js
```

### Backup Retention

By default, the system keeps:

- All backups from the last 7 days
- Weekly backups for the last 4 weeks
- Monthly backups for the last 12 months

Older backups are automatically deleted during the cleanup process.

## Recovery Process

To restore a backup, use the restore script:

```bash
node scripts/restore.js [backup-file]
```

If you don't specify a backup file, the script will list all available backups and prompt you to select one.

### Recovery Steps

1. Run the restore script: `node scripts/restore.js`
2. Select the backup to restore from the list
3. Confirm the restoration (this will overwrite the current database)
4. Wait for the restoration to complete

## Security Considerations

### Backup Encryption

To enable backup encryption, set the `BACKUP_ENCRYPTION_KEY` environment variable to a 32-byte hex string. You can generate a suitable key using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Access Control

Ensure that backup files are protected with appropriate file system permissions. Only authorized users should have access to the backup directories.

## Monitoring and Logging

The backup system logs all activities to the application's logging system. You can monitor backup operations by checking the logs.

Successful backups will be logged with the following information:

- Timestamp
- Backup file path
- File size
- Checksum (if verification is enabled)
- Remote storage URL (if applicable)

## Troubleshooting

### Common Issues

1. **Backup fails with "Permission denied"**
   - Ensure the application has write permissions to the backup directories.

2. **Restore fails with "Backup file not found"**
   - Check that the specified backup file exists and is accessible.

3. **Encryption/decryption fails**
   - Verify that the encryption key is correctly set and has not changed since the backup was created.

### Backup Verification

If a backup fails verification, check the logs for details on why the verification failed. Common reasons include:

- Corrupted backup file
- Incorrect checksum
- Incomplete backup process

## Best Practices

1. **Regular Testing**: Periodically test the recovery process to ensure backups can be successfully restored.
2. **Off-site Storage**: Configure remote storage to protect against local hardware failures.
3. **Encryption**: Enable encryption for backups containing sensitive data.
4. **Monitoring**: Regularly check backup logs to ensure backups are completing successfully.
5. **Documentation**: Keep this documentation updated with any changes to the backup system.

## HIPAA Compliance Features

The backup system includes several features designed to meet HIPAA compliance requirements:

### Audit Logging

All backup and restore operations are logged with detailed information:

- Who performed the operation (user ID)
- When the operation was performed (timestamp)
- What operation was performed (backup, restore, access)
- What data was affected (database, files)
- Additional metadata about the operation

The audit logs are stored in a tamper-evident format using a hash chain, which allows verification that logs have not been modified after the fact.

### Log Retention

Audit logs are retained for a minimum of 7 years (2555 days) as required by HIPAA regulations. The system includes automatic log rotation to manage log file sizes while maintaining the required retention period.

### Access Control

The backup system implements strict access controls:

- Only authorized administrators can initiate backups and restores
- All access to backup files is logged
- Backup files can be encrypted to prevent unauthorized access

### Log Verification

The system includes tools to verify the integrity of audit logs:

```bash
node scripts/verify-audit-logs.js
```

This command checks that the hash chain in the audit logs is intact and has not been tampered with.

## Future Enhancements

Planned enhancements for the backup system include:

- Point-in-time recovery using database WAL (Write-Ahead Logging)
- Backup management UI for administrators
- More granular backup scheduling options
- Additional remote storage providers
- Automated backup verification and testing
- Enhanced encryption options for backups
- Role-based access control for backup operations
