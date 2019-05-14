var update = document.getElementById('update');
var del = document.getElementById('delete');

update.addEventListener('click', function () {
    fetch('edit', {
        method: 'put',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          'full_name': 'Modified-Name!',
          'nickname': 'New nickname'
        })
      })
      .then(res => {
          if (res.ok) return res.json();
      })
      .then(data => {
          console.log(data);
          window.location.reload(true)
      });
})

del.addEventListener('click', function() {
    fetch('delete', {
        method: 'delete',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            'full_name': 'a'
        })
    })
    .then(res => {
        if (res.ok) return res.json()
    })
    .then(data => {
        console.log(data)
        window.location.reload(true)
    });
});