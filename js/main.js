
function addBtnClone() {
    const clone = document.createElement('a')
    clone.className = 'btn'
    clone.textContent = 'Clone'
    clone.onclick = () => {
        treeHeaderLast.style.gridTemplateColumns = '1fr 1fr'
        const input = document.createElement('input')
        input.setAttribute('readonly', true)
        input.style.fontSize = 'bold';
        input.style.padding = '5px';
        input.value = `git clone https://${window.token}@github.com/${window.owner}/${window.repo}`;
        clone.remove()

        const copy = document.createElement('a')
        copy.className = 'btn'
        copy.textContent = 'Copy'
        copy.onclick = () => {
            input.focus()
            input.select()
            document.execCommand('copy')
            treeHeaderLast.innerHTML = ''
            treeHeaderLast.style.gridTemplateColumns = '1fr'
            treeHeaderLast.append(clone);
            var _ = clone.onclick;
            clone.onclick = undefined;
            clone.textContent = 'Copied!';
            clone.style.cursor = 'default';
            setTimeout(() => {
                clone.style.cursor = 'pointer';
                clone.onclick = _;
                clone.textContent = 'Clone';
            }, 1500);
        }
        treeHeaderLast.innerHTML = ''
        treeHeaderLast.append(input, copy)
    }
    treeHeaderLast.append(clone)
}

import { Octokit } from "https://esm.sh/octokit";
import mime from "https://cdn.skypack.dev/mime/lite";
mime._types.py = 'application/python'

marked.use({
  highlight: (code, lang) => {
    if (Prism.languages[lang]) {
      return Prism.highlight(code, Prism.languages[lang], lang);
    } else {
      return code;
    }
  },
  pedantic: false,
  gfm: true,
});

const DEFAULT_API_HEADERS = { headers: {
    'X-GitHub-Api-Version': '2022-11-28',
    'Accept-Charset': 'UTF-8'
} };

const
    rawBtn = document.getElementById('raw-btn'),
    previewDiv = document.getElementById('preview-div'),
    previewItemNameDiv = document.getElementById('preview-item-name-div'),
    previewItemContentDiv = document.getElementById('preview-item-content-div'),
    treeUl = document.getElementById('tree-ul'),
    cwdNameDiv = document.getElementById('cwd-name-div'),
    locationDiv = document.getElementById('location-div'),
    treeHeaderLast = document.querySelector('.tree > .header > .last');

async function initMarkdownView(md) {
    var el = document.createElement('pre');
    el.classList.add('markdown');
    // console.log(md);
    el.innerHTML = DOMPurify.sanitize(marked.parse(md));
    // el.innerHTML = (await octokit.request('POST /markdown', {
    //     text: md,
    //     headers: DEFAULT_API_HEADERS.headers
    // })).data;
    previewItemContentDiv.appendChild(el);
}

function decodeContent(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}


async function gotoPath(path) {
    if (path.endsWith('..')) {
        // go back
        path = path.split('/').slice(0, -2).join('/');
    }
    var headerName = path ? path.split('/').at(-1) : window.repo;
    // get required path
    // 2 caces: requied path is a dir || file
    // if it is a dir: do dir view & view dir's README.md if exists
    // if it is a file: show content of this file
    try {
        var response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner, repo, path,
            headers: DEFAULT_API_HEADERS.headers,
        })
    } catch ( err ) {
        if (err.response.status === 404) {
            // if path is invalid or repo is invalid => panic:-
            // owner, repo or path is invalid => panic
            alert('[404]: owner, repo or path is invalid')
            return;
        }
    }

    if (response.data.length) {
        /* path is a dir */
        previewDiv.hidden = true;
        cwdNameDiv.innerHTML = headerName;
        treeUl.hidden = false;
        // set treeUl items
        treeUl.querySelectorAll('tree-item').forEach(el => el.remove());
        if (path != '') {
            var treeItem = document.createElement('tree-item');
            treeItem.setAttribute('data-item-name', '..');
            treeItem.setAttribute('data-item-path', path + '/..');
            treeItem.setAttribute('data-item-type', 'dir');
            treeUl.appendChild(treeItem);
        }
        var
            dirItems = [],
            fileItems = [];
        response.data.forEach((item) => { item.type === 'dir' ? dirItems.push(item) : fileItems.push(item) });
        dirItems.concat(fileItems).forEach((item) => {
            var treeItem = document.createElement('tree-item');
            treeItem.setAttribute('data-item-name', item.name);
            treeItem.setAttribute('data-item-path', item.path);
            treeItem.setAttribute('data-item-type', item.type);
            treeUl.appendChild(treeItem);
        })
        var readMeExists = treeUl.querySelector('[data-item-name*="readme"]') || treeUl.querySelector('[data-item-name*="README"]')
        if (readMeExists) {
            try {
                response = await octokit.request('GET /repos/{owner}/{repo}/readme/{dir}', {
                    owner, repo, dir: path,
                    headers: DEFAULT_API_HEADERS.headers,
                }).catch((e) => {})
                previewItemContentDiv.innerHTML = '';
                previewDiv.hidden = false;
                previewItemNameDiv.innerHTML = response.data.name;
                initMarkdownView(decodeContent(response.data.content));
            } catch ( err ) {
                if (err.response.status === 404 || err.status === 404) {
                    // no README.md, this is ok
                } else {
                    throw err;
                }
            }
        }
    } else {
        /* path is a file */
        treeUl.hidden = true;
        previewItemNameDiv.innerHTML = headerName;
        previewItemContentDiv.innerHTML = '';
        var m = String(mime.getType(path)); // m.slice(0, m.indexOf('/'))
        if (m.startsWith('image/')) {
            // img render
            var b64content = response.data.content;
            if (b64content) {
                var imgSrc = `data:image/${headerName.split('.').at(-1)};base64,${response.data.content}`;
            } else {
                var imgSrc = response.data.download_url;
            }
            previewItemContentDiv.innerHTML = `
                <div class="content-img">
                    <img src="${imgSrc}">
                </div>
            `;
        } else if (m.endsWith('/pdf')) {
            // pdf render
            previewItemContentDiv.innerHTML = `
                <iframe
                    src="https://mozilla.github.io/pdf.js/web/viewer.html?file=${response.data.download_url}"
                    frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:99%;width:100%;"
                    >
                    <div style="
                            padding: 5%;    position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                        ">
                        <h3 style="margin: auto; text-align: center;">PDF preview is not supported in this browser.</h3>
                        <h4 style="margin: auto; text-align: center;">sorry for any inconvenience.</h4>
                    </div>
                </iframe>
            `;
        } else if (m.endsWith('/markdown')) {
            // md parse
            initMarkdownView(decodeContent(response.data.content));
        } else {
            // normal text file
            var
                el = document.createElement('pre'),
                lang = headerName.split('.').at(-1),
                txt = decodeContent(response.data.content);
            if (!Prism.languages[lang]) {
                var _ = /\blang(?:uage)?-([\w-]+)\b/i.exec(txt);
                if (_) lang = _[1];
            }
            if (Prism.languages[lang]) {
                el.innerHTML = DOMPurify.sanitize(Prism.highlight(txt, Prism.languages[lang], lang));
            } else {
                el.textContent = txt;
            }
            previewItemContentDiv.appendChild(el);
        }
        previewDiv.hidden = false;
        // set Raw url
        rawBtn.setAttribute('href', response.data.download_url);
    }
    if (path.startsWith('/')) path = path.slice(1);
    window.path = path;
    // set Location bar
    locationDiv.innerHTML = '';
    var pathSplit = path.split('/')
    var onLocationClick = (evt) => {
        var el = evt.target;
        var parentChildren = el.parentNode.querySelectorAll('a');
        var
            pathToGo = '',
            child,
            itemName;
        for (let i = 0; i <= parentChildren.length; i++) {
            child = parentChildren[i];
            itemName = child.getAttribute('data-item-name');
            if (itemName) {
                pathToGo += '/' + itemName;
            }
            if (child == el) break;
        }
        gotoPath(pathToGo);
    }

    if (path) {
        var a = document.createElement('a');
        a.style.cursor = 'pointer';
        a.onclick = onLocationClick;
        a.setAttribute('data-item-name', '');
    } else {
        var a = document.createElement('span');
    }
    a.innerHTML = window.repo;
    locationDiv.appendChild(a);
    if (path) {
        pathSplit.slice(0, -1).forEach((i)=>{
            var slash = document.createElement('span');
            slash.innerHTML = ' / ';
            locationDiv.appendChild(slash);
            var a = document.createElement('a');
            a.style.cursor = 'pointer';
            a.onclick = onLocationClick;
            a.setAttribute('data-item-name', i);
            a.innerHTML = i;
            locationDiv.appendChild(a);
        });
        var slash = document.createElement('span');
        slash.innerHTML = ' / ';
        locationDiv.appendChild(slash);
        var span = document.createElement('span')
        span.innerHTML = pathSplit.at(-1);
        locationDiv.appendChild(span);
    }
    locationDiv.hidden = false;

}

class TreeItem extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    this.innerHTML = `
        <li class="entry" style="cursor: pointer;">
            <img class="icon ${this.getAttribute('data-item-type')}">
            <a>${this.getAttribute('data-item-name')}</a>
        </li>
    `;
    this.getElementsByTagName('a')[0].addEventListener('click', () => {
        gotoPath(this.getAttribute('data-item-path'));
    })
  }
}
customElements.define("tree-item", TreeItem);


(async () => {
    var urlParams = new URLSearchParams(document.location.search);
    window.repo = urlParams.get('repo');
    if (!repo) {
        // no repo-name is supplied => panic
        alert('no repo name is supplied in url params')
        return;
    }
    window.token = urlParams.get('token');
    if (!token) {
        // no token is supplied => panic
        alert('no token is supplied in url params')
        return;
    }
    token = JSON.parse(urlParams.get('token_ready')) ? token : atob(token);
    window.octokit = new Octokit({ auth: token/*, log: { info: ()=>{} }*/ });
    // check token
    try {
        var tokenAuthenticatedUser = (await octokit.request('GET /user', DEFAULT_API_HEADERS)).data.login;
    } catch (err) {
        if (err.response.status === 401) {
            // token is not valid: panic
            alert('Github access token is NOT valid')
            return;
        }
    }

    window.path = urlParams.get('path');
    path = path ? path : '';

    window.owner = urlParams.get('owner');
    // if no usernae is supplied, then: set is as the user who created that access_token
    owner = owner ? owner : tokenAuthenticatedUser;

    document.title = `${owner} / ${repo} · ${document.title}`;
    addBtnClone();


    // get required path
    await gotoPath(path)
})();
