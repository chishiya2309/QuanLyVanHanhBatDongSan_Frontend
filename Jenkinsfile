pipeline {
    agent any

    environment {
        // SonarQube chạy nội bộ trên cùng EC2 Jenkins (khớp với Backend)
        SONAR_HOST_URL = 'http://localhost:9000'
        // Giới hạn heap Node.js tránh tràn RAM khi build Vite + TypeScript
        NODE_OPTIONS   = '--max-old-space-size=2048'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    stages {
        stage('Initialize & Clean Workspace') {
            steps {
                echo '=== Bước 1: Khởi tạo & Dọn dẹp Workspace ==='
                sh '''
                    echo "Build Number: ${BUILD_NUMBER}"
                    node -v
                    npm -v
                    gitleaks version
                    trivy --version
                    git clean -fdx -e node_modules || true
                '''
            }
        }

        stage('Checkout SCM') {
            steps {
                echo '=== Bước 2: Kéo mã nguồn từ GitHub Repository ==='
                checkout scm
            }
        }

        stage('DevSecOps: Secret Scanning (Gitleaks)') {
            steps {
                echo '=== Bước 3: Quét lộ lọt Secret / API Keys với Gitleaks ==='
                // Đổi buildResult thành 'FAILURE' nếu muốn chặn cứng pipeline khi phát hiện lộ secret
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh '''
                        mkdir -p reports
                        gitleaks detect \
                            --source=. \
                            --verbose \
                            --redact \
                            --report-format json \
                            --report-path reports/gitleaks-frontend-report.json
                    '''
                }
            }
        }

        stage('Install, Lint, Test & Build') {
            steps {
                echo '=== Bước 4: Cài thư viện, Kiểm tra Lint, Chạy Vitest & Build Production ==='
                sh 'npm ci --prefer-offline --no-audit'
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh 'npm run lint'
                    sh 'npm test'
                }
                sh 'npm run build'
            }
        }

        stage('DevSecOps: Static Code Analysis (SonarQube)') {
            steps {
                echo '=== Bước 5: Phân tích chất lượng mã nguồn & Lỗ hổng SAST với SonarQube ==='
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    withCredentials([string(credentialsId: 'sonarqube-frontend-token', variable: 'SONAR_TOKEN')]) {
                        sh '''
                            sonar-scanner \
                                -Dsonar.projectKey=rentops-frontend \
                                -Dsonar.host.url=${SONAR_HOST_URL} \
                                -Dsonar.token=${SONAR_TOKEN}
                        '''
                    }
                }
            }
        }

        stage('DevSecOps: Dependency Vulnerability Scan (Trivy FS)') {
            steps {
                echo '=== Bước 6: Quét lỗ hổng bảo mật thư viện npm với Trivy ==='
                sh '''
                    mkdir -p reports
                    trivy fs \
                        --scanners vuln \
                        --severity HIGH,CRITICAL \
                        --format table \
                        --output reports/trivy-frontend-report.txt \
                        .
                    trivy fs \
                        --scanners vuln \
                        --severity HIGH,CRITICAL \
                        --format json \
                        --output reports/trivy-frontend-report.json \
                        .
                    cat reports/trivy-frontend-report.txt
                '''
            }
        }

        stage('Trigger AWS Amplify Deploy') {
            when {
                expression {
                    return env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main'
                }
            }
            steps {
                echo '=== Bước 7: Kích hoạt Deploy Frontend lên AWS Amplify ==='
                withCredentials([string(credentialsId: 'amplify-frontend-webhook-url', variable: 'AMPLIFY_WEBHOOK_URL')]) {
                    sh '''
                        curl -f -s -S -X POST \
                            -H "Content-Type: application/json" \
                            -d '{}' \
                            "${AMPLIFY_WEBHOOK_URL}"
                    '''
                }
            }
        }
    }

    post {
        always {
            echo '=== Lưu trữ báo cáo DevSecOps & Dọn dẹp thư mục build tạm ==='
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            sh '''
                rm -rf dist build reports || true
            '''
        }
        success {
            echo 'DevSecOps Pipeline Frontend hoàn tất thành công & Đã kích hoạt AWS Amplify Deploy!'
        }
        failure {
            echo 'Pipeline Frontend gặp lỗi. Vui lòng kiểm tra Console Output ở stage bị lỗi!'
        }
    }
}
