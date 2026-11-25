const installButton=document.querySelector('#installApp');
const standalone=window.matchMedia('(display-mode: standalone)');
let installPrompt=null;
function installed(){return standalone.matches||navigator.standalone===true}
function updateButton(){installButton.hidden=installed()}
updateButton();standalone.addEventListener('change',updateButton);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateButton()});
window.addEventListener('appinstalled',()=>{installPrompt=null;installButton.hidden=true});
function showInstallGuide(){
 let dialog=document.querySelector('#installGuide');if(!dialog){dialog=document.createElement('dialog');dialog.id='installGuide';document.body.append(dialog)}
 dialog.innerHTML='<h2>씨앤씨 앱 설치</h2><p>안드로이드: 브라우저 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해주세요.</p><p>아이폰: Safari에서 공유 버튼을 누르고 <strong>홈 화면에 추가</strong>를 선택해주세요.</p><p>인터넷 연결이 필요해요. 설치 메뉴가 없으면 Chrome 또는 Safari에서 사이트를 열어주세요.</p><div class="actions"><button type="button" class="primary" id="closeInstallGuide">닫기</button></div>';
 dialog.querySelector('#closeInstallGuide').onclick=()=>dialog.close();dialog.showModal();
}
installButton.onclick=async()=>{if(!installPrompt){showInstallGuide();return}const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice}catch{showInstallGuide()}};
function connectionNotice(){let el=document.querySelector('#offlineNotice');if(!el){el=document.createElement('div');el.id='offlineNotice';el.setAttribute('role','status');el.textContent='인터넷 연결이 끊겼어요. 연결 후 다시 불러오거나 저장해주세요.';document.querySelector('.workspace').prepend(el)}el.hidden=navigator.onLine}
connectionNotice();window.addEventListener('online',connectionNotice);window.addEventListener('offline',connectionNotice);
if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{console.info('설치 기능을 준비하지 못했어요. 브라우저 메뉴에서 홈 화면 추가를 사용할 수 있어요.')})})}
