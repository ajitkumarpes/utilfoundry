up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

processor-test:
	python3 -m venv .processor-venv
	.processor-venv/bin/pip install --disable-pip-version-check -r processor/requirements.txt
	PYTHONPATH=processor .processor-venv/bin/python -m unittest -v processor/test_app.py

clean:
	docker compose down -v
