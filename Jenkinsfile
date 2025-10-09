pipeline {
    agent any // Default agent

    environment {
        // 로컬에서 사용할 이미지 이름을 정의합니다.
        IMAGE_NAME = 'inventory-value-exporter'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code from Version Control...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            agent {
                docker { image 'node:20-slim' }
            }
            steps {
                echo 'Installing Node.js dependencies...'
                sh 'npm install'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // BUILD_NUMBER는 Jenkins에서 제공하는 환경 변수입니다.
                    def dockerImage = "${IMAGE_NAME}:${env.BUILD_NUMBER}"
                    echo "Building Docker image: ${dockerImage}"
                    
                    // Dockerfile을 사용하여 이미지 빌드
                    sh "docker build -t ${dockerImage} ."
                }
            }
        }

        stage('Deploy (Local)') {
            steps {
                script {
                    def dockerImage = "${IMAGE_NAME}:${env.BUILD_NUMBER}"
                    echo "Deploying image ${dockerImage} on the Jenkins agent..."

                    // Jenkins 에이전트에서 기존 컨테이너를 중지하고 새 버전으로 실행합니다.
                    // 이 단계는 Jenkins 에이전트가 Docker를 실행할 수 있어야 합니다.
                                sh """
                                    docker stop ${IMAGE_NAME} || true
                                    docker rm ${IMAGE_NAME} || true
                                    docker run -d --restart always --name ${IMAGE_NAME} -p 8001:9101 ${dockerImage}
                                """                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
            cleanWs()
        }
        success {
            echo 'Pipeline executed successfully.'
        }
        failure {
            echo 'Pipeline failed.'
        }
    }
}
