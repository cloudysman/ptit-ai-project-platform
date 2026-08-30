/* Lộ trình nghề nghiệp: mỗi lộ trình là một chuỗi project đã sắp thứ tự. */

import { LoiApi, apiCatalog } from './api.js';
import { $, chu, dongTrong, soGio, tenLevel, theoDoiHienDan, thongBao } from './giao-dien.js';
import { moProject } from './project.js';

// Chi tiết từng lộ trình chỉ tải khi người dùng mở ra, và tải một lần rồi nhớ lại.
const daTai = new Map();

function veMotBuoc(buoc) {
  const project = buoc.project;
  return (
    '<li class="buoc-hang">' +
    `<button type="button" class="buoc-project" data-mo-project="${chu(project.slug)}">${chu(project.title)}</button>` +
    `<span class="buoc-the">${chu(tenLevel(project.level))} · ${chu(project.track.name)} · ${chu(soGio(project.estimated_hours))}</span>` +
    (buoc.note ? `<span class="buoc-ghi-chu">${chu(buoc.note)}</span>` : '') +
    '</li>'
  );
}

function veThe(loTrinh) {
  return (
    `<article class="lo-trinh-the hien-dan" data-slug="${chu(loTrinh.slug)}">` +
    `<h3>${chu(loTrinh.name)}</h3>` +
    `<p class="lo-trinh-mo">${chu(loTrinh.description)}</p>` +
    '<button type="button" class="nut nut-vien" data-mo-buoc aria-expanded="false">Xem các bước</button>' +
    '<ol class="lo-trinh-buoc" hidden></ol>' +
    '</article>'
  );
}

async function moBuoc(the) {
  const slug = the.dataset.slug;
  const oBuoc = the.querySelector('.lo-trinh-buoc');
  const nut = the.querySelector('[data-mo-buoc]');

  if (!oBuoc.hidden) {
    oBuoc.hidden = true;
    nut.textContent = 'Xem các bước';
    nut.setAttribute('aria-expanded', 'false');
    return;
  }

  if (!daTai.has(slug)) {
    nut.disabled = true;
    try {
      daTai.set(slug, await apiCatalog.chiTietLoTrinh(slug));
    } catch (loi) {
      nut.disabled = false;
      thongBao(loi instanceof LoiApi ? loi.message : 'Không tải được lộ trình.', 'loi');
      return;
    }
    nut.disabled = false;
    oBuoc.innerHTML = daTai.get(slug).steps.map(veMotBuoc).join('');
  }

  oBuoc.hidden = false;
  nut.textContent = 'Thu lại';
  nut.setAttribute('aria-expanded', 'true');
}

export async function nap() {
  const o = $('#lo-trinh-luoi');
  try {
    const danhSach = await apiCatalog.danhSachLoTrinh();
    o.innerHTML =
      danhSach.length > 0 ? danhSach.map(veThe).join('') : dongTrong('Chưa có lộ trình nào.');
    theoDoiHienDan();
  } catch (loi) {
    o.innerHTML = dongTrong(loi instanceof LoiApi ? loi.message : 'Không tải được lộ trình.');
  }
}

export function khoiTao() {
  $('#lo-trinh-luoi').addEventListener('click', (sk) => {
    const nutBuoc = sk.target.closest('[data-mo-buoc]');
    if (nutBuoc) {
      moBuoc(nutBuoc.closest('.lo-trinh-the'));
      return;
    }
    const nutProject = sk.target.closest('[data-mo-project]');
    if (nutProject) moProject(nutProject.dataset.moProject);
  });
}
