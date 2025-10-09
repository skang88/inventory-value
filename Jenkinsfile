pipeline {
    agent any

    environment {
        // Docker Hub 사용자 이름 또는 Private Registry 주소로 변경하세요.
        REGISTRY = 'your-docker-hub-username'
        IMAGE_NAME = 'inventory-value-exporter'
    }

    stages {
        stage('Checkout') {
            steps {
                // Jenkins가 SCM(Git 등)에서 코드를 자동으로 체크아웃합니다.
                echo 'Checking out code...'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "Building Docker image: ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}"
                // Dockerfile을 사용하여 이미지 빌드
                sh "docker build -t ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER} ."
            }
        }

        stage('Push to Registry') {
            steps {
                // Jenkins에 등록된 Docker Registry 인증 정보의 ID로 변경하세요.
                withCredentials([usernamePassword(credentialsId: 'docker-registry-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    echo 'Logging in and pushing image...'
                    sh "docker login -u ${DOCKER_USER} -p ${DOCKER_PASS}"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}"
                    sh "docker logout"
                }
            }
        }

        stage('Deploy') {
            steps {
                echo 'This is a placeholder for the deployment stage.'
                // 예시: SSH를 통해 원격 서버에 접속하여 컨테이너를 실행하는 스크립트
                /*
                sshagent(['your-remote-server-ssh-credentials']) {
                   sh '''
                     ssh user@your-remote-server.com "
                       docker pull ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER} && \
                       docker stop ${IMAGE_NAME} || true && \
                       docker rm ${IMAGE_NAME} || true && \
                       docker run -d --name ${IMAGE_NAME} -p 9101:9101 ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}
                     "
                   '''
                }
                */
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
    }
}
